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
  const { table, row, replica, outbox } = params;

  await replica.upsertMany(table, [row]);

  const candidates = await outbox.findByTableRecord(table, row.id);
  for (const tx of candidates) {
    if (tx.status === "synced") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (shouldAck(tx as any, row as any)) {
      await outbox.updateStatus(tx.tx_id, "synced", {
        synced_at: new Date().toISOString(),
      });
    }
  }
}
