import { supabase } from "@/lib/supabase";
import type {
  ConflictReason,
  OutboxTransaction,
  RemoteRow,
  TableName,
} from "@/lib/sync/types";
import type { ConflictStore } from "@/stores/ConflictStore";
import type { OutboxStore } from "@/stores/OutboxStore";
import type { ReplicaStore } from "@/stores/ReplicaStore";

export type PushResult<T extends TableName> =
  | { status: "applied"; appliedRow: RemoteRow<T> }
  | {
      status: "conflict";
      serverRow: RemoteRow<T>;
      localRow: unknown;
      reason: ConflictReason;
    };

export interface PushRemote {
  apply<T extends TableName>(
    tx: OutboxTransaction<T>
  ): Promise<PushResult<T>>;
}

export class SupabasePushRemote implements PushRemote {
  async apply<T extends TableName>(
    tx: OutboxTransaction<T>
  ): Promise<PushResult<T>> {
    if (tx.op === "insert") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(tx.table) as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ id: tx.record_id, ...(tx.payload as any) })
        .select("*")
        .single();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { status: "applied", appliedRow: data as any as RemoteRow<T> };
    }

    if (tx.op === "update") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(tx.table) as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(tx.payload as any)
        .eq("id", tx.record_id)
        .eq("updated_at", tx.base_updated_at)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: serverRow, error: fetchError } = await (
          supabase.from(tx.table) as any // eslint-disable-line @typescript-eslint/no-explicit-any
        )
          .select("*")
          .eq("id", tx.record_id)
          .maybeSingle();
        if (fetchError) throw fetchError;

        return {
          status: "conflict",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          serverRow: serverRow as any as RemoteRow<T>,
          localRow: tx.payload,
          reason: "update_precondition_failed",
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { status: "applied", appliedRow: data as any as RemoteRow<T> };
    }

    // delete = soft delete
    const deletedAt = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(tx.table) as any)
      .update({ deleted_at: deletedAt })
      .eq("id", tx.record_id)
      .eq("updated_at", tx.base_updated_at)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: serverRow, error: fetchError } = await (
        supabase.from(tx.table) as any // eslint-disable-line @typescript-eslint/no-explicit-any
      )
        .select("*")
        .eq("id", tx.record_id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      return {
        status: "conflict",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serverRow: serverRow as any as RemoteRow<T>,
        localRow: { deleted_at: deletedAt },
        reason: "update_precondition_failed",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: "applied", appliedRow: data as any as RemoteRow<T> };
  }
}

// Parent tables must be pushed before child tables that reference them via FK.
const TABLE_PUSH_ORDER: Record<string, number> = {
  sources: 0,
  entities: 0,
  identifiers: 1,
  relations: 1,
  intel: 1,
  intel_entities: 2,
};

export async function drainOutboxOnce(params: {
  remote: PushRemote;
  outbox: OutboxStore;
  replica: ReplicaStore;
  conflicts: ConflictStore;
  limit?: number;
}): Promise<number> {
  const pending = await params.outbox.getPending(params.limit ?? 50);
  if (pending.length === 0) return 0;
  pending.sort((a, b) => {
    const oa = TABLE_PUSH_ORDER[a.table] ?? 9;
    const ob = TABLE_PUSH_ORDER[b.table] ?? 9;
    if (oa !== ob) return oa - ob;
    return a.created_at.localeCompare(b.created_at);
  });
  for (const tx of pending) {
    await params.outbox.updateStatus(tx.tx_id, "syncing");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await params.remote.apply(tx as any);
      if (result.status === "applied") {
        await params.replica.upsertMany(tx.table, [result.appliedRow]);
        await params.outbox.updateStatus(tx.tx_id, "synced", {
          synced_at: new Date().toISOString(),
        });
      } else {
        await params.conflicts.addConflict({
          table: tx.table,
          recordId: tx.record_id,
          serverRow: result.serverRow,
          localRow: result.localRow,
          reason: result.reason,
        });
        await params.replica.upsertMany(tx.table, [result.serverRow]);
        await params.outbox.updateStatus(tx.tx_id, "synced", {
          synced_at: new Date().toISOString(),
          last_error: "conflict_logged",
        });
      }
    } catch (err) {
      await params.outbox.updateStatus(tx.tx_id, "error", {
        attempt_count: tx.attempt_count + 1,
        last_error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return pending.length;
}
