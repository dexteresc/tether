import { supabase } from '../../lib/supabase'
import type { ConflictReason, OutboxTransaction, RemoteRow, TableName } from '../../lib/sync/types'
import type { ConflictStore } from '../../stores/ConflictStore'
import type { OutboxStore } from '../../stores/OutboxStore'
import type { ReplicaStore } from '../../stores/ReplicaStore'

export type PushResult<T extends TableName> =
  | { status: 'applied'; appliedRow: RemoteRow<T> }
  | { status: 'conflict'; serverRow: RemoteRow<T>; localRow: unknown; reason: ConflictReason }

export interface PushRemote {
  apply<T extends TableName>(tx: OutboxTransaction<T>): Promise<PushResult<T>>
}

export class SupabasePushRemote implements PushRemote {
  async apply<T extends TableName>(tx: OutboxTransaction<T>): Promise<PushResult<T>> {
    if (tx.op === 'insert') {
      const { data, error } = await (supabase.from(tx.table) as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .insert({ id: tx.record_id, ...(tx.payload as any) }) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select('*')
        .single()
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { status: 'applied', appliedRow: data as any as RemoteRow<T> }
    }

    if (tx.op === 'update') {
      const { data, error } = await (supabase.from(tx.table) as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update(tx.payload as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', tx.record_id)
        .eq('updated_at', tx.base_updated_at)
        .select('*')
        .maybeSingle()

      if (error) throw error

      if (!data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: serverRow, error: fetchError } = await (supabase.from(tx.table) as any)
          .select('*')
          .eq('id', tx.record_id)
          .maybeSingle()
        if (fetchError) throw fetchError

        return {
          status: 'conflict',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          serverRow: serverRow as any as RemoteRow<T>,
          localRow: tx.payload,
          reason: 'update_precondition_failed',
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { status: 'applied', appliedRow: data as any as RemoteRow<T> }
    }

    // delete = soft delete
    const deletedAt = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(tx.table) as any)
      .update({ deleted_at: deletedAt })
      .eq('id', tx.record_id)
      .eq('updated_at', tx.base_updated_at)
      .select('*')
      .maybeSingle()

    if (error) throw error

    if (!data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: serverRow, error: fetchError } = await (supabase.from(tx.table) as any)
        .select('*')
        .eq('id', tx.record_id)
        .maybeSingle()
      if (fetchError) throw fetchError

      return {
        status: 'conflict',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serverRow: serverRow as any as RemoteRow<T>,
        localRow: { deleted_at: deletedAt },
        reason: 'update_precondition_failed',
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: 'applied', appliedRow: data as any as RemoteRow<T> }
  }
}

export async function drainOutboxOnce(params: {
  remote: PushRemote
  outbox: OutboxStore
  replica: ReplicaStore
  conflicts: ConflictStore
  limit?: number
}): Promise<void> {
  const pending = await params.outbox.getPending(params.limit ?? 50)
  for (const tx of pending) {
    await params.outbox.updateStatus(tx.tx_id, 'syncing')
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await params.remote.apply(tx as any)
      if (result.status === 'applied') {
        await params.replica.upsertMany(tx.table, [result.appliedRow])
        await params.outbox.updateStatus(tx.tx_id, 'synced', { synced_at: new Date().toISOString() })
      } else {
        await params.conflicts.addConflict({
          table: tx.table,
          recordId: tx.record_id,
          serverRow: result.serverRow,
          localRow: result.localRow,
          reason: result.reason,
        })
        await params.replica.upsertMany(tx.table, [result.serverRow])
        await params.outbox.updateStatus(tx.tx_id, 'synced', {
          synced_at: new Date().toISOString(),
          last_error: 'conflict_logged',
        })
      }
    } catch (err) {
      await params.outbox.updateStatus(tx.tx_id, 'error', {
        attempt_count: tx.attempt_count + 1,
        last_error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

