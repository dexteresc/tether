import { makeAutoObservable, runInAction } from 'mobx'
import { getTetherDb } from '../lib/idb/db'
import { OUTBOX_INDEXES } from '../lib/idb/schema'
import type { OutboxStatus, OutboxTransaction, TableName } from '../lib/sync/types'
import type { SyncStatusStore } from './SyncStatusStore'

export class OutboxStore {
  items: OutboxTransaction[] = []
  loaded = false
  private readonly syncStatus: SyncStatusStore

  constructor(syncStatus: SyncStatusStore) {
    this.syncStatus = syncStatus
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async refresh(): Promise<void> {
    const db = await getTetherDb()
    const rows = await db.getAllFromIndex('outbox_transactions', OUTBOX_INDEXES.byCreatedAt)

    runInAction(() => {
      this.items = rows
      this.loaded = true
      this.syncStatus.setPendingOutboxCount(this.items.filter((t) => t.status === 'pending').length)
    })
  }

  async enqueue(tx: OutboxTransaction): Promise<void> {
    const db = await getTetherDb()
    await db.put('outbox_transactions', tx)
    await this.refresh()
  }

  async getPending(limit = 50): Promise<OutboxTransaction[]> {
    const db = await getTetherDb()
    const rows = await db.getAllFromIndex('outbox_transactions', OUTBOX_INDEXES.byStatus, 'pending', limit)
    return rows
  }

  async updateStatus(txId: string, status: OutboxStatus, patch?: Partial<OutboxTransaction>): Promise<void> {
    const db = await getTetherDb()
    const existing = await db.get('outbox_transactions', txId)
    if (!existing) return
    await db.put('outbox_transactions', { ...existing, ...patch, status })
    await this.refresh()
  }

  async findByTableRecord(table: TableName, recordId: string): Promise<OutboxTransaction[]> {
    const db = await getTetherDb()
    const rows = await db.getAllFromIndex(
      'outbox_transactions',
      OUTBOX_INDEXES.byTableRecord,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [table, recordId] as any,
    )
    return rows
  }
}

