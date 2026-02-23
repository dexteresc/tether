import { getTetherDb } from "@/lib/idb/db";
import type {
  OutboxTransaction,
  RemoteRow,
  ReplicaMeta,
  TableName,
} from "@/lib/sync/types";

/**
 * Update a record locally (outbox + replica) so changes appear immediately
 * in the UI and get synced to Supabase on the next tick.
 */
export async function updateRecord<T extends TableName>(
  table: T,
  id: string,
  fields: Partial<RemoteRow<T>>
): Promise<void> {
  const db = await getTetherDb();
  const now = new Date().toISOString();

  const existing = await db.get(table, id);
  if (!existing) {
    throw new Error(`Record not found: ${table}/${id}`);
  }

  const tx: OutboxTransaction<T> = {
    tx_id: crypto.randomUUID(),
    created_at: now,
    table,
    op: "update",
    record_id: id,
    payload: { ...fields, updated_at: now } as Partial<RemoteRow<T>>,
    base_updated_at: existing.__meta?.base_updated_at ?? null,
    status: "pending",
    attempt_count: 0,
    last_error: null,
    next_retry_at: null,
    synced_at: null,
  };
  await db.put("outbox_transactions", tx);

  // Update replica with dirty flag
  const meta: ReplicaMeta = {
    ...existing.__meta,
    local_last_accessed_at: now,
    local_dirty: true,
  };
  await db.put(table, {
    ...existing,
    ...fields,
    updated_at: now,
    __meta: meta,
  });
}
