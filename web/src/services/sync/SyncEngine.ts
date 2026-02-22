import type { SyncOrchestrator } from "./index";
import type { SyncStatusStore } from "@/stores/SyncStatusStore";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export class SyncEngine {
  private intervalId: number | null = null;
  private running = false;
  private readonly syncStatus: SyncStatusStore;
  private readonly orchestrator: SyncOrchestrator;
  private readonly intervalMs: number;

  constructor(
    syncStatus: SyncStatusStore,
    orchestrator: SyncOrchestrator,
    intervalMs = 5000
  ) {
    this.syncStatus = syncStatus;
    this.orchestrator = orchestrator;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.syncStatus.setConnectionStatus(
      navigator.onLine ? "online" : "offline"
    );

    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);

    this.intervalId = window.setInterval(
      () => void this.tick(),
      this.intervalMs
    );
    void this.tick();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);

    if (this.intervalId != null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.orchestrator.stop();
  }

  private onOnline = () => {
    this.syncStatus.setConnectionStatus("online");
    void this.tick();
  };

  private onOffline = () => {
    this.syncStatus.setConnectionStatus("offline");
  };

  private async tick(): Promise<void> {
    try {
      const result = await this.orchestrator.tick();
      if (result.pushed > 0 || result.pulled) {
        this.syncStatus.setLastSyncAt(new Date().toISOString());
      }
      this.syncStatus.setLastError(null);
    } catch (err: unknown) {
      this.syncStatus.setLastError(toErrorMessage(err));
    } finally {
      this.syncStatus.setProgress("idle");
    }
  }
}
