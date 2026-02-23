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

export type PushResult =
  | { status: "applied"; appliedRow: RemoteRow<TableName> }
  | {
      status: "conflict";
      serverRow: RemoteRow<TableName>;
      localRow: unknown;
      reason: ConflictReason;
    };

export interface PushRemote {
  apply(tx: OutboxTransaction): Promise<PushResult>;
}

/**
 * Supabase's typed SDK cannot handle dynamic table names at the type level.
 * When `table` is a `TableName` union, `.insert()` and `.update()` require
 * a payload that satisfies ALL table Insert/Update types simultaneously,
 * which is impossible for a single dynamic payload.
 *
 * This helper performs the raw PostgREST operations using the REST client
 * directly, bypassing the per-table type constraints while keeping full
 * runtime safety (RLS, validation, etc. still apply server-side).
 */
function dynamicFrom(table: TableName) {
  // All TableName values are valid Database table keys.
  // We use a concrete table type to satisfy TypeScript, but the actual
  // table used at runtime is determined by the `table` parameter.
  // This is safe because we only use generic operations (select *, eq, insert, update).
  return supabase.from(table as "entities");
}

export class SupabasePushRemote implements PushRemote {
  private async fetchConflictRow(
    tx: OutboxTransaction,
    localRow: unknown,
    reason: ConflictReason
  ): Promise<PushResult> {
    const { data: serverRow, error } = await dynamicFrom(tx.table)
      .select("*")
      .eq("id", tx.record_id)
      .maybeSingle();
    if (error) throw error;

    return {
      status: "conflict",
      serverRow: serverRow as RemoteRow<TableName>,
      localRow,
      reason,
    };
  }

  async apply(tx: OutboxTransaction): Promise<PushResult> {
    if (tx.op === "insert") {
      const { data, error } = await dynamicFrom(tx.table)
        .insert({ id: tx.record_id, ...tx.payload } as RemoteRow<"entities">)
        .select("*")
        .single();
      if (error) throw error;
      return { status: "applied", appliedRow: data as RemoteRow<TableName> };
    }

    if (tx.op === "update") {
      const builder = dynamicFrom(tx.table)
        .update(tx.payload as Record<string, unknown>)
        .eq("id", tx.record_id);

      const query = tx.base_updated_at
        ? builder.eq("updated_at", tx.base_updated_at)
        : builder;

      const { data, error } = await query.select("*").maybeSingle();

      if (error) throw error;

      if (!data) {
        return this.fetchConflictRow(tx, tx.payload, "update_precondition_failed");
      }

      return { status: "applied", appliedRow: data as RemoteRow<TableName> };
    }

    // delete = soft delete
    const deletedAt = new Date().toISOString();
    const builder = dynamicFrom(tx.table)
      .update({ deleted_at: deletedAt } as Record<string, unknown>)
      .eq("id", tx.record_id);

    const query = tx.base_updated_at
      ? builder.eq("updated_at", tx.base_updated_at)
      : builder;

    const { data, error } = await query.select("*").maybeSingle();

    if (error) throw error;

    if (!data) {
      return this.fetchConflictRow(tx, { deleted_at: deletedAt }, "update_precondition_failed");
    }

    return { status: "applied", appliedRow: data as RemoteRow<TableName> };
  }
}

// Parent tables must be pushed before child tables that reference them via FK.
const TABLE_PUSH_ORDER: Record<string, number> = {
  sources: 0,
  entities: 0,
  tags: 0,
  identifiers: 1,
  relations: 1,
  intel: 1,
  entity_attributes: 1,
  record_tags: 1,
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
      const result = await params.remote.apply(tx);
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
