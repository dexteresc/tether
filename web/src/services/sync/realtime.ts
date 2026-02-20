import type { RemoteRow, TableName } from "@/lib/sync/types";
import type { OutboxStore } from "@/stores/OutboxStore";
import type { ReplicaStore } from "@/stores/ReplicaStore";
import { shouldAck } from "./ack";

export type RealtimeUnsubscribe = () => void;

export interface RealtimeRemote {
  subscribeAllTables(
    onRowChange: (table: TableName, row: RemoteRow<TableName>) => void
  ): RealtimeUnsubscribe;
}

export async function applyRealtimeRowChange(params: {
  table: TableName;
  row: RemoteRow<TableName>;
  replica: ReplicaStore;
  outbox: OutboxStore;
}): Promise<void> {
  await params.replica.upsertMany(params.table, [params.row]);

  const candidates = await params.outbox.findByTableRecord(
    params.table,
    params.row.id
  );
  for (const tx of candidates) {
    if (tx.status === "synced") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (shouldAck(tx as any, params.row as any)) {
      await params.outbox.updateStatus(tx.tx_id, "synced", {
        synced_at: new Date().toISOString(),
      });
    }
  }
}
