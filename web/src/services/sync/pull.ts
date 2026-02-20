import { supabase } from "@/lib/supabase";
import { getTetherDb } from "@/lib/idb/db";
import type { SyncLogBatch, SyncLogEntry, TableName } from "@/lib/sync/types";
import { TABLES } from "@/lib/sync/types";

const LAST_SEQ_KEY = "sync_log.last_seq";

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

export async function getLastSeq(): Promise<number> {
  const db = await getTetherDb();
  const entry = await db.get("sync_state", LAST_SEQ_KEY);
  if (entry?.value && typeof entry.value === "number") return entry.value;
  return 0;
}

export async function setLastSeq(seq: number): Promise<void> {
  const db = await getTetherDb();
  await db.put("sync_state", {
    key: LAST_SEQ_KEY,
    value: seq,
    updated_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Fetch from sync_log
// ---------------------------------------------------------------------------

export async function fetchSyncLog(
  sinceSeq: number,
  limit = 500
): Promise<SyncLogBatch> {
  const { data, error } = await supabase
    .from("sync_log")
    .select("*")
    .gt("seq", sinceSeq)
    .order("seq", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const entries = (data ?? []) as unknown as SyncLogEntry[];
  const lastSeq =
    entries.length > 0 ? entries[entries.length - 1]!.seq : sinceSeq;

  return {
    entries,
    last_seq: lastSeq,
    has_more: entries.length >= limit,
  };
}

// ---------------------------------------------------------------------------
// Apply a batch of sync log entries to IDB
// ---------------------------------------------------------------------------

export async function applySyncLogBatch(
  batch: SyncLogBatch
): Promise<void> {
  const db = await getTetherDb();

  // Group entries by table so we open one transaction per table
  const byTable = new Map<TableName, SyncLogEntry[]>();
  for (const entry of batch.entries) {
    if (!TABLES.includes(entry.table_name as TableName)) continue;
    const table = entry.table_name as TableName;
    let list = byTable.get(table);
    if (!list) {
      list = [];
      byTable.set(table, list);
    }
    list.push(entry);
  }

  for (const [table, entries] of byTable) {
    const tx = db.transaction(table, "readwrite");
    for (const entry of entries) {
      if (entry.operation === "DELETE") {
        const existing = await tx.store.get(entry.record_id);
        if (existing?.__meta?.local_dirty) continue;
        await tx.store.delete(entry.record_id);
      } else {
        // INSERT or UPDATE — upsert row_data with __meta
        const existing = await tx.store.get(entry.record_id);
        if (existing?.__meta?.local_dirty) continue;

        const now = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = entry.row_data as any;
        const isDeleted = !!rowData?.deleted_at;
        const next = {
          ...rowData,
          __meta: {
            local_last_accessed_at: now,
            local_dirty: false,
            local_deleted: isDeleted,
            base_updated_at: null,
            last_pulled_at: now,
          },
        };
        await tx.store.put(next);
      }
    }
    await tx.done;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: first sync when last_seq === 0
// Fetches all rows from all tables directly, then sets cursor to max(seq).
// ---------------------------------------------------------------------------

export async function bootstrapFullSync(): Promise<void> {
  const db = await getTetherDb();
  const now = new Date().toISOString();

  for (const table of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(table) as any).select("*");
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) continue;

    const tx = db.transaction(table, "readwrite");
    for (const row of rows) {
      const id = row.id as string;
      const existing = await tx.store.get(id);
      if (existing?.__meta?.local_dirty) continue;

      const isDeleted = !!row.deleted_at;
      const next = {
        ...row,
        __meta: {
          local_last_accessed_at: now,
          local_dirty: false,
          local_deleted: isDeleted,
          base_updated_at: null,
          last_pulled_at: now,
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.store.put(next as any);
    }
    await tx.done;
  }

  // Get the current max seq so we start incremental sync from here
  const { data: seqData, error: seqError } = await supabase
    .from("sync_log")
    .select("seq")
    .order("seq", { ascending: false })
    .limit(1);

  if (seqError) throw seqError;

  const maxSeq =
    seqData && seqData.length > 0
      ? (seqData[0] as unknown as { seq: number }).seq
      : 0;

  await setLastSeq(maxSeq);

  // Clean up old per-table cursor keys
  const stateTx = db.transaction("sync_state", "readwrite");
  for (const table of TABLES) {
    await stateTx.store.delete(`table.${table}.cursor_updated_at`);
  }
  await stateTx.done;
}

// ---------------------------------------------------------------------------
// Entry point — called each tick
// ---------------------------------------------------------------------------

export async function pullFromSyncLog(
  limit = 500
): Promise<{ has_more: boolean }> {
  const lastSeq = await getLastSeq();

  if (lastSeq === 0) {
    await bootstrapFullSync();
    return { has_more: false };
  }

  const batch = await fetchSyncLog(lastSeq, limit);

  if (batch.entries.length > 0) {
    await applySyncLogBatch(batch);
    await setLastSeq(batch.last_seq);
  }

  return { has_more: batch.has_more };
}
