import { makeAutoObservable } from 'mobx'
import { getTetherDb } from '../lib/idb/db'
import { REPLICA_INDEXES } from '../lib/idb/schema'
import type { RemoteRow, ReplicaMeta, ReplicaRow, TableName } from '../lib/sync/types'

function nowIso(): string {
  return new Date().toISOString()
}

function withReplicaMeta<T extends { id: string }>(row: T, existingMeta?: ReplicaMeta): ReplicaRow<T> {
  const meta: ReplicaMeta = existingMeta ?? {
    local_last_accessed_at: nowIso(),
    local_dirty: false,
    local_deleted: false,
    base_updated_at: null,
    last_pulled_at: null,
  }

  return { ...row, __meta: meta }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.store.put(withReplicaMeta(row, existingMeta) as any)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results.push(cursor.value as any)
      cursor = await cursor.continue()
    }

    await tx.done
    return results
  }
}

