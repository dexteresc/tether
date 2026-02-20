import type { AuthStore } from "@/stores/AuthStore";
import type { ConflictStore } from "@/stores/ConflictStore";
import type { OutboxStore } from "@/stores/OutboxStore";
import type { ReplicaStore } from "@/stores/ReplicaStore";
import { pullFromSyncLog } from "./pull";
import { SupabasePushRemote, drainOutboxOnce } from "./push";

const MAX_BATCHES_PER_TICK = 5;

export interface SyncOrchestrator {
  tick(): Promise<void>;
  stop(): void;
}

export function createSyncOrchestrator(deps: {
  auth: AuthStore;
  replica: ReplicaStore;
  outbox: OutboxStore;
  conflicts: ConflictStore;
}): SyncOrchestrator {
  const pushRemote = new SupabasePushRemote();
  let stopped = false;

  return {
    async tick() {
      if (stopped) return;
      if (!deps.auth.isAuthenticated) return;

      // Push local changes first
      await drainOutboxOnce({
        remote: pushRemote,
        outbox: deps.outbox,
        replica: deps.replica,
        conflicts: deps.conflicts,
      });

      // Pull from sync log — drain up to MAX_BATCHES_PER_TICK batches of 500
      for (let i = 0; i < MAX_BATCHES_PER_TICK; i++) {
        const { has_more } = await pullFromSyncLog(500);
        if (!has_more) break;
      }
    },
    stop() {
      stopped = true;
    },
  };
}
