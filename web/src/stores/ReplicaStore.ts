import { makeAutoObservable } from "mobx";
import { getTetherDb } from "@/lib/idb/db";
import { REPLICA_INDEXES } from "@/lib/idb/schema";
import type {
  RemoteRow,
  ReplicaMeta,
  ReplicaRow,
  TableName,
} from "@/lib/sync/types";

function nowIso(): string {
  return new Date().toISOString();
}

export class ReplicaStore {
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async getById<T extends TableName>(
    table: T,
    id: string
  ): Promise<ReplicaRow<RemoteRow<T>> | undefined> {
    const db = await getTetherDb();
    const row = await db.get(table, id);
    if (!row) return undefined;

    row.__meta.local_last_accessed_at = nowIso();
    await db.put(table, row);

    return row;
  }

  async upsertMany<T extends TableName>(
    table: T,
    rows: Array<RemoteRow<T>>
  ): Promise<void> {
    const db = await getTetherDb();
    const tx = db.transaction(table, "readwrite");

    for (const row of rows) {
      const existing = await tx.store.get(row.id);
      const existingMeta = existing?.__meta;
      if (existingMeta?.local_dirty) continue;

      const rowRecord = row as Record<string, unknown>;
      const isDeleted = !!rowRecord.deleted_at;

      const meta: ReplicaMeta = existingMeta ?? {
        local_last_accessed_at: nowIso(),
        local_dirty: false,
        local_deleted: isDeleted,
        base_updated_at: null,
        last_pulled_at: null,
      };

      meta.local_deleted = isDeleted;

      tx.store.put({ ...row, __meta: meta } as ReplicaRow<RemoteRow<T>>);
    }

    await tx.done;
  }

  async listByUpdatedAt<T extends TableName>(
    table: T,
    limit: number
  ): Promise<Array<ReplicaRow<RemoteRow<T>>>> {
    const db = await getTetherDb();
    const tx = db.transaction(table, "readonly");
    const index = tx.store.index(REPLICA_INDEXES.byUpdatedAt);

    const results: Array<ReplicaRow<RemoteRow<T>>> = [];
    let cursor = await index.openCursor(null, "prev");
    while (cursor && results.length < limit) {
      const row = cursor.value;
      const rowRecord = row as Record<string, unknown>;
      if (!row.__meta.local_deleted && !rowRecord.deleted_at) {
        results.push(row);
      }
      cursor = await cursor.continue();
    }

    await tx.done;
    return results;
  }
}
