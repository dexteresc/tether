import type { AuthStore } from '../../stores/AuthStore'
import type { ConflictStore } from '../../stores/ConflictStore'
import type { OutboxStore } from '../../stores/OutboxStore'
import type { ReplicaStore } from '../../stores/ReplicaStore'
import { TABLES } from '../../lib/sync/types'
import { SupabasePullRemote, pullOnce } from './pull'
import { SupabasePushRemote, drainOutboxOnce } from './push'

export interface SyncOrchestrator {
  tick(): Promise<void>
  stop(): void
}

export function createSyncOrchestrator(deps: {
  auth: AuthStore
  replica: ReplicaStore
  outbox: OutboxStore
  conflicts: ConflictStore
}): SyncOrchestrator {
  const pullRemote = new SupabasePullRemote()
  const pushRemote = new SupabasePushRemote()
  let stopped = false

  async function pullAllOnce(): Promise<void> {
    for (const table of TABLES) {
      await pullOnce(pullRemote, table, 200)
    }
  }

  return {
    async tick() {
      if (stopped) return
      if (!deps.auth.isAuthenticated) return
      await drainOutboxOnce({ remote: pushRemote, outbox: deps.outbox, replica: deps.replica, conflicts: deps.conflicts })
      await pullAllOnce()
    },
    stop() {
      stopped = true
    },
  }
}

