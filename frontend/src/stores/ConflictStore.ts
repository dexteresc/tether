import { makeAutoObservable, runInAction } from 'mobx'
import { getTetherDb } from '../lib/idb/db'
import { CONFLICT_INDEXES } from '../lib/idb/schema'
import type { ConflictEntry, ConflictReason, TableName } from '../lib/sync/types'

export class ConflictStore {
  items: ConflictEntry[] = []
  loaded = false

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async refresh(): Promise<void> {
    const db = await getTetherDb()
    const rows = await db.getAllFromIndex('conflict_log', CONFLICT_INDEXES.byStatus, 'pending_review')
    runInAction(() => {
      this.items = rows
      this.loaded = true
    })
  }

  async addConflict(params: {
    table: TableName
    recordId: string
    serverRow: unknown
    localRow: unknown
    reason: ConflictReason
  }): Promise<ConflictEntry> {
    const now = new Date().toISOString()
    const entry: ConflictEntry = {
      conflict_id: crypto.randomUUID(),
      created_at: now,
      table: params.table,
      record_id: params.recordId,
      server_row: params.serverRow,
      local_row: params.localRow,
      reason: params.reason,
      status: 'pending_review',
      note: null,
    }

    const db = await getTetherDb()
    await db.put('conflict_log', entry)
    await this.refresh()
    return entry
  }

  async listByTableRecord(table: TableName, recordId: string): Promise<ConflictEntry[]> {
    const db = await getTetherDb()
    const rows = await db.getAllFromIndex(
      'conflict_log',
      CONFLICT_INDEXES.byTableRecord,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [table, recordId] as any,
    )
    return rows
  }
}

