import { getTetherDb } from "@/lib/idb/db";
import type {
  OutboxTransaction,
  RemoteRow,
  ReplicaMeta,
  TableName,
} from "@/lib/sync/types";

/**
 * Soft-delete a record locally (sets deleted_at, writes to outbox).
 */
export async function softDeleteRecord(
  table: TableName,
  id: string
): Promise<void> {
  const db = await getTetherDb();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await db.get(table as TableName & string, id) as any;
  if (!existing) {
    throw new Error(`Record not found: ${table}/${id}`);
  }

  const updated = {
    ...existing,
    deleted_at: now,
    updated_at: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __meta: _meta, ...payload } = updated;

  const tx: OutboxTransaction = {
    tx_id: crypto.randomUUID(),
    created_at: now,
    table,
    op: "delete",
    record_id: id,
    payload: payload as Partial<RemoteRow<typeof table>>,
    base_updated_at: existing.__meta?.base_updated_at ?? null,
    status: "pending",
    attempt_count: 0,
    last_error: null,
    next_retry_at: null,
    synced_at: null,
  };
  await db.put("outbox_transactions", tx);

  const meta: ReplicaMeta = {
    ...existing.__meta,
    local_last_accessed_at: now,
    local_dirty: true,
    local_deleted: true,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.put(table as TableName & string, { ...updated, __meta: meta } as any);
}
