import { getTetherDb } from "@/lib/idb/db";
import type {
  TableName,
  OutboxOperation,
  OutboxTransaction,
  RemoteRow,
  ReplicaMeta,
  ReplicaRow,
} from "@/lib/sync/types";

function nowIso(): string {
  return new Date().toISOString();
}

function defaultTxId(): string {
  return crypto.randomUUID();
}

function ensureReplicaMeta(existing?: ReplicaMeta): ReplicaMeta {
  return (
    existing ?? {
      local_last_accessed_at: nowIso(),
      local_dirty: false,
      local_deleted: false,
      base_updated_at: null,
      last_pulled_at: null,
    }
  );
}

export interface LocalCommitParams<T extends TableName> {
  table: T;
  op: OutboxOperation;
  record_id: string;
  payload: Partial<RemoteRow<T>>;
  now?: string;
  txIdFactory?: () => string;
}

export async function localCommit<T extends TableName>(
  params: LocalCommitParams<T>
): Promise<OutboxTransaction<T>> {
  const db = await getTetherDb();
  const now = params.now ?? nowIso();
  const txIdFactory = params.txIdFactory ?? defaultTxId;

  const txId = txIdFactory();
  const idbTx = db.transaction(
    [params.table, "outbox_transactions"],
    "readwrite"
  );

  const existing = await idbTx.objectStore(params.table).get(params.record_id);
  const existingMeta = existing?.__meta;
  const baseUpdatedAt =
    params.op === "insert" ? null : (existing?.updated_at ?? null);

  const mergedRow = {
    ...(existing ?? {}),
    ...params.payload,
    id: params.record_id,
    updated_at: now,
    created_at: existing?.created_at ?? now,
    deleted_at:
      params.op === "delete"
        ? now
        : ((params.payload as { deleted_at?: string | null }).deleted_at ??
          null),
  };

  const nextMeta: ReplicaMeta = {
    ...ensureReplicaMeta(existingMeta),
    local_last_accessed_at: now,
    local_dirty: true,
    local_deleted: params.op === "delete",
    base_updated_at: existingMeta?.base_updated_at ?? baseUpdatedAt,
  };

  const replicaRow: ReplicaRow<RemoteRow<T>> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(mergedRow as any),
    __meta: nextMeta,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  idbTx.objectStore(params.table).put(replicaRow as any);

  const outboxTx: OutboxTransaction<T> = {
    tx_id: txId,
    created_at: now,
    table: params.table,
    op: params.op,
    record_id: params.record_id,
    payload: params.payload,
    base_updated_at: baseUpdatedAt,
    status: "pending",
    attempt_count: 0,
    last_error: null,
    next_retry_at: null,
    synced_at: null,
  };

  idbTx.objectStore("outbox_transactions").put(outboxTx);
  await idbTx.done;
  return outboxTx;
}
