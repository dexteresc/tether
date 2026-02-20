import { getTetherDb } from "@/lib/idb/db";
import type {
  OutboxTransaction,
  RemoteRow,
  ReplicaMeta,
  TableName,
} from "@/lib/sync/types";

/**
 * Create a record locally (outbox + replica) so it appears immediately
 * in the UI and gets synced to Supabase on the next tick.
 */
export async function createRecord<T extends TableName>(
  table: T,
  fields: Omit<Partial<RemoteRow<T>>, "id" | "created_at" | "updated_at" | "deleted_at">
): Promise<string> {
  const db = await getTetherDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const row = {
    ...fields,
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  } as RemoteRow<T>;

  // Write to outbox for sync to Supabase
  const tx: OutboxTransaction<T> = {
    tx_id: crypto.randomUUID(),
    created_at: now,
    table,
    op: "insert",
    record_id: id,
    payload: row,
    base_updated_at: null,
    status: "pending",
    attempt_count: 0,
    last_error: null,
    next_retry_at: null,
    synced_at: null,
  };
  await db.put("outbox_transactions", tx);

  // Write to replica for immediate local display
  const meta: ReplicaMeta = {
    local_last_accessed_at: now,
    local_dirty: true,
    local_deleted: false,
    base_updated_at: null,
    last_pulled_at: null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.put(table as T & string, { ...row, __meta: meta } as any);

  return id;
}
