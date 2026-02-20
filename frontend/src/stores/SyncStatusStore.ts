import { makeAutoObservable } from 'mobx'

export type ConnectionStatus = 'online' | 'offline' | 'unknown'

export interface SyncProgress {
  phase: 'idle' | 'pull' | 'push' | 'reconcile'
  startedAt: string | null
  lastTickAt: string | null
}

export class SyncStatusStore {
  connectionStatus: ConnectionStatus = 'unknown'
  lastSyncAt: string | null = null
  lastError: string | null = null
  progress: SyncProgress = { phase: 'idle', startedAt: null, lastTickAt: null }
  pendingOutboxCount = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status
  }

  setPendingOutboxCount(count: number): void {
    this.pendingOutboxCount = count
  }

  setLastSyncAt(iso: string | null): void {
    this.lastSyncAt = iso
  }

  setLastError(error: string | null): void {
    this.lastError = error
  }

  setProgress(phase: SyncProgress['phase']): void {
    const now = new Date().toISOString()
    if (phase === 'idle') {
      this.progress = { phase, startedAt: null, lastTickAt: now }
      return
    }
    if (this.progress.phase !== phase) {
      this.progress = { phase, startedAt: now, lastTickAt: now }
      return
    }
    this.progress.lastTickAt = now
  }
}

