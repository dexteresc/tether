import { supabase } from '../../lib/supabase'
import { getTetherDb } from '../../lib/idb/db'
import type { ChangeBatch, RemoteRow, TableName } from '../../lib/sync/types'

export interface PullRemote {
  fetchChanges<T extends TableName>(table: T, sinceUpdatedAt: string, limit: number): Promise<ChangeBatch<T>>
}

export class SupabasePullRemote implements PullRemote {
  async fetchChanges<T extends TableName>(table: T, sinceUpdatedAt: string, limit: number): Promise<ChangeBatch<T>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(table) as any)
      .select('*')
      .gt('updated_at', sinceUpdatedAt)
      .order('updated_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any as Array<RemoteRow<T>>
    const nextCursor = rows.length > 0 ? rows[rows.length - 1]!.updated_at : sinceUpdatedAt
    const now = new Date().toISOString()

    return {
      table,
      since_updated_at: sinceUpdatedAt,
      rows,
      next_cursor_updated_at: nextCursor,
      server_time: now,
    }
  }
}

export async function getTableCursorUpdatedAt(table: TableName): Promise<string> {
  const db = await getTetherDb()
  const key = `table.${table}.cursor_updated_at`
  const entry = await db.get('sync_state', key)
  if (entry?.value && typeof entry.value === 'string') return entry.value
  return new Date(0).toISOString()
}

export async function setTableCursorUpdatedAt(table: TableName, cursor: string): Promise<void> {
  const db = await getTetherDb()
  const key = `table.${table}.cursor_updated_at`
  await db.put('sync_state', { key, value: cursor, updated_at: new Date().toISOString() })
}

export async function applyChangeBatch<T extends TableName>(batch: ChangeBatch<T>): Promise<void> {
  const db = await getTetherDb()
  const tx = db.transaction(batch.table, 'readwrite')
  for (const row of batch.rows) {
    const existing = await tx.store.get(row.id)
    const existingMeta = existing?.__meta
    if (existingMeta?.local_dirty) continue

    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDeleted = !!(row as any).deleted_at
    const next = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(row as any),
      __meta: {
        local_last_accessed_at: now,
        local_dirty: false,
        local_deleted: isDeleted,
        base_updated_at: null,
        last_pulled_at: batch.server_time,
      },
    }
    tx.store.put(next)
  }
  await tx.done
}

export async function pullOnce<T extends TableName>(
  remote: PullRemote,
  table: T,
  limit = 200,
): Promise<ChangeBatch<T>> {
  const cursor = await getTableCursorUpdatedAt(table)
  const batch = await remote.fetchChanges(table, cursor, limit)
  await applyChangeBatch(batch)
  await setTableCursorUpdatedAt(table, batch.next_cursor_updated_at)
  return batch
}

