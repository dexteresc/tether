import { makeAutoObservable } from 'mobx'
import { getTetherDb } from '../lib/idb/db'
import { REPLICA_INDEXES } from '../lib/idb/schema'
import type { RemoteRow, ReplicaMeta, ReplicaRow, TableName } from '../lib/sync/types'

function nowIso(): string {
  return new Date().toISOString()
}

export class ReplicaStore {
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async getById<T extends TableName>(table: T, id: string): Promise<ReplicaRow<RemoteRow<T>> | undefined> {
    const db = await getTetherDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (await db.get(table as T & string, id)) as any
    if (!row) return undefined

    row.__meta.local_last_accessed_at = nowIso()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.put(table as T & string, row as any)

    return row
  }

  async upsertMany<T extends TableName>(table: T, rows: Array<RemoteRow<T>>): Promise<void> {
    const db = await getTetherDb()
    const tx = db.transaction(table as T & string, 'readwrite')

    for (const row of rows) {
      const existing = await tx.store.get(row.id)
      const existingMeta = existing?.__meta
      if (existingMeta?.local_dirty) continue

      // Check if the row is deleted
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isDeleted = !!(row as any).deleted_at

      const meta: ReplicaMeta = existingMeta ?? {
        local_last_accessed_at: nowIso(),
        local_dirty: false,
        local_deleted: isDeleted,
        base_updated_at: null,
        last_pulled_at: null,
      }

      // Update local_deleted flag based on server state
      meta.local_deleted = isDeleted

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.store.put({ ...row, __meta: meta } as any)
    }

    await tx.done
  }

  async listByUpdatedAt<T extends TableName>(table: T, limit: number): Promise<Array<ReplicaRow<RemoteRow<T>>>> {
    const db = await getTetherDb()
    const tx = db.transaction(table as T & string, 'readonly')
    const index = tx.store.index(REPLICA_INDEXES.byUpdatedAt)

    const results: Array<ReplicaRow<RemoteRow<T>>> = []
    let cursor = await index.openCursor(null, 'prev')
    while (cursor && results.length < limit) {
      const row = cursor.value
      // Filter out deleted records
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!row.__meta.local_deleted && !(row as any).deleted_at) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results.push(row as any)
      }
      cursor = await cursor.continue()
    }

    await tx.done
    return results
  }
}

