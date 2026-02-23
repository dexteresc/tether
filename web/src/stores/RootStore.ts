import { reaction } from "mobx";
import { AuthStore } from "./AuthStore";
import { ConflictStore } from "./ConflictStore";
import { NLQueueStore } from "./NLQueueStore";
import { OutboxStore } from "./OutboxStore";
import { ReplicaStore } from "./ReplicaStore";
import { SyncStatusStore } from "./SyncStatusStore";
import { SyncEngine } from "@/services/sync/SyncEngine";
import { createSyncOrchestrator } from "@/services/sync";

export class RootStore {
  readonly auth: AuthStore;
  readonly syncStatus: SyncStatusStore;
  readonly replica: ReplicaStore;
  readonly outbox: OutboxStore;
  readonly nlQueue: NLQueueStore;
  readonly conflicts: ConflictStore;
  readonly syncEngine: SyncEngine;

  private disposeAuthReaction: (() => void) | undefined = undefined;

  constructor() {
    this.syncStatus = new SyncStatusStore();
    this.replica = new ReplicaStore();
    this.outbox = new OutboxStore(this.syncStatus);
    this.conflicts = new ConflictStore();
    this.nlQueue = new NLQueueStore();
    this.auth = new AuthStore();

    this.syncEngine = new SyncEngine(
      this.syncStatus,
      createSyncOrchestrator({
        auth: this.auth,
        replica: this.replica,
        outbox: this.outbox,
        conflicts: this.conflicts,
        syncStatus: this.syncStatus,
      })
    );
  }

  /**
   * Start the auth reaction that controls sync engine lifecycle.
   * Called after the auth bridge has been set up.
   */
  startAuthReaction(): void {
    this.disposeAuthReaction ??= reaction(
      () => this.auth.isAuthenticated,
      (isAuthed) => {
        if (isAuthed) this.syncEngine.start();
        else this.syncEngine.stop();
      },
      { fireImmediately: true }
    );
  }

  dispose(): void {
    this.disposeAuthReaction?.();
    this.disposeAuthReaction = undefined;
    this.syncEngine.stop();
  }
}
