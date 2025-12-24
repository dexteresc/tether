import type { OutboxTransaction, RemoteRow, TableName } from '../../lib/sync/types'

export function shouldAck<T extends TableName>(
  tx: OutboxTransaction<T>,
  serverRow: Pick<RemoteRow<T>, 'id' | 'updated_at' | 'deleted_at'>,
): boolean {
  if (serverRow.id !== tx.record_id) return false

  if (tx.op === 'insert') return true
  if (!tx.base_updated_at) return false

  if (tx.op === 'update') return serverRow.updated_at > tx.base_updated_at
  if (tx.op === 'delete') return serverRow.deleted_at != null && serverRow.updated_at > tx.base_updated_at

  return false
}

