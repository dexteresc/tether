import type { AuthStore } from "@/stores/AuthStore";
import type { ConflictStore } from "@/stores/ConflictStore";
import type { OutboxStore } from "@/stores/OutboxStore";
import type { ReplicaStore } from "@/stores/ReplicaStore";
import type { SyncStatusStore } from "@/stores/SyncStatusStore";
import { pullFromSyncLog } from "./pull";
import { SupabasePushRemote, drainOutboxOnce } from "./push";

const MAX_BATCHES_PER_TICK = 5;

export interface TickResult {
  pushed: number;
  pulled: boolean;
}

export interface SyncOrchestrator {
  tick(): Promise<TickResult>;
  stop(): void;
}

export function createSyncOrchestrator(deps: {
  auth: AuthStore;
  replica: ReplicaStore;
  outbox: OutboxStore;
  conflicts: ConflictStore;
  syncStatus: SyncStatusStore;
}): SyncOrchestrator {
  const pushRemote = new SupabasePushRemote();
  let stopped = false;

  return {
    async tick(): Promise<TickResult> {
      if (stopped) return { pushed: 0, pulled: false };
      if (!deps.auth.isAuthenticated) return { pushed: 0, pulled: false };

      // Push local changes (only show "push" phase if there's work)
      const pending = await deps.outbox.getPending(50);
      if (pending.length > 0) {
        deps.syncStatus.setProgress("push");
      }
      const pushed = await drainOutboxOnce({
        remote: pushRemote,
        outbox: deps.outbox,
        replica: deps.replica,
        conflicts: deps.conflicts,
      });

      // Pull from sync log — drain up to MAX_BATCHES_PER_TICK batches of 500
      deps.syncStatus.setProgress("pull");
      let pulled = false;
      for (let i = 0; i < MAX_BATCHES_PER_TICK; i++) {
        const { has_more } = await pullFromSyncLog(500);
        pulled = true;
        if (!has_more) break;
      }

      return { pushed, pulled };
    },
    stop() {
      stopped = true;
    },
  };
}
