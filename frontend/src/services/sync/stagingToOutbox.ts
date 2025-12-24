import { getTetherDb } from '../../lib/idb/db'
import { getAcceptedStagedExtractions } from '../../lib/idb/staged'
import type { OutboxTransaction, StagedExtraction, TableName } from '../../lib/sync/types'
import type { Database } from '../../lib/types'

type RemoteRow<T extends TableName> = Database['public']['Tables'][T]['Row']

/**
 * Converts accepted staged rows into outbox transactions
 * This commits the staged extractions to the local database and queues them for sync
 */
export async function commitStagedToOutbox(): Promise<{
  committed: number
  failed: number
  errors: Array<{ stagedId: string; error: string }>
}> {
  const stagedRows = await getAcceptedStagedExtractions()

  if (stagedRows.length === 0) {
    return { committed: 0, failed: 0, errors: [] }
  }

  const db = await getTetherDb()
  const now = new Date().toISOString()
  let committed = 0
  let failed = 0
  const errors: Array<{ stagedId: string; error: string }> = []

  // Group staged rows by input_id for batch processing
  const stagedByInputId = new Map<string, StagedExtraction[]>()
  for (const staged of stagedRows) {
    const items = stagedByInputId.get(staged.input_id) || []
    items.push(staged)
    stagedByInputId.set(staged.input_id, items)
  }

  // Process each input's staged rows
  for (const [, inputStagedRows] of stagedByInputId) {
    try {
      // Create outbox transactions for each staged row
      const outboxTxs: OutboxTransaction[] = []

      for (const staged of inputStagedRows) {
        const proposedRow = staged.proposed_row as Partial<RemoteRow<TableName>>

        if (!proposedRow || typeof proposedRow !== 'object') {
          errors.push({ stagedId: staged.staged_id, error: 'Invalid proposed row data' })
          failed++
          continue
        }

        const recordId = (proposedRow as { id?: string }).id || crypto.randomUUID()

        const tx: OutboxTransaction = {
          tx_id: crypto.randomUUID(),
          created_at: now,
          table: staged.table,
          op: 'insert',
          record_id: recordId,
          payload: {
            ...proposedRow,
            id: recordId,
          },
          base_updated_at: null,
          status: 'pending',
          attempt_count: 0,
          last_error: null,
          next_retry_at: null,
          synced_at: null,
        }

        outboxTxs.push(tx)
      }

      // Write all outbox transactions and mark staged rows as committed in a transaction
      const outboxWriteTx = db.transaction('outbox_transactions', 'readwrite')
      await Promise.all(outboxTxs.map((tx) => outboxWriteTx.store.put(tx)))
      await outboxWriteTx.done

      committed += outboxTxs.length

      // Clean up staged rows after successful commit
      const stagedWriteTx = db.transaction('staged_extractions', 'readwrite')
      await Promise.all(
        inputStagedRows.map((staged) =>
          stagedWriteTx.store.delete(staged.staged_id)
        )
      )
      await stagedWriteTx.done

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      inputStagedRows.forEach((staged) => {
        errors.push({ stagedId: staged.staged_id, error: errorMessage })
      })
      failed += inputStagedRows.length
    }
  }

  return { committed, failed, errors }
}

/**
 * Commits staged rows for a specific input ID
 */
export async function commitStagedForInput(inputId: string): Promise<void> {
  const db = await getTetherDb()
  const stagedRows = await db.getAllFromIndex('staged_extractions', 'by_input_id', inputId)

  const acceptedRows = stagedRows.filter((row) => row.status === 'accepted')

  if (acceptedRows.length === 0) {
    return
  }

  const now = new Date().toISOString()
  const outboxTxs: OutboxTransaction[] = []

  for (const staged of acceptedRows) {
    const proposedRow = staged.proposed_row as Partial<RemoteRow<TableName>>

    if (!proposedRow || typeof proposedRow !== 'object') {
      continue
    }

    const recordId = (proposedRow as { id?: string }).id || crypto.randomUUID()

    const tx: OutboxTransaction = {
      tx_id: crypto.randomUUID(),
      created_at: now,
      table: staged.table,
      op: 'insert',
      record_id: recordId,
      payload: {
        ...proposedRow,
        id: recordId,
      },
      base_updated_at: null,
      status: 'pending',
      attempt_count: 0,
      last_error: null,
      next_retry_at: null,
      synced_at: null,
    }

    outboxTxs.push(tx)
  }

  // Write all outbox transactions
  const outboxWriteTx = db.transaction('outbox_transactions', 'readwrite')
  await Promise.all(outboxTxs.map((tx) => outboxWriteTx.store.put(tx)))
  await outboxWriteTx.done

  // Clean up staged rows
  const stagedWriteTx = db.transaction('staged_extractions', 'readwrite')
  await Promise.all(acceptedRows.map((staged) => stagedWriteTx.store.delete(staged.staged_id)))
  await stagedWriteTx.done
}
