import { makeAutoObservable, runInAction } from 'mobx'
import { getTetherDb } from '../lib/idb/db'
import { NL_QUEUE_INDEXES } from '../lib/idb/schema'
import type { NlQueueItem, NlQueueStatus } from '../lib/sync/types'
import { getLlmClient } from '../services/llm/LlmClient'
import { mapExtractionToStagedRows } from '../services/llm/mapping'
import type { ClassifiedExtractionResponse } from '../services/llm/types'

const MOVING_AVERAGE_WINDOW = 5

export class NLQueueStore {
  items: NlQueueItem[] = []
  loaded = false
  isProcessing = false
  processingDurations: number[] = [] // Store last N processing durations in seconds

  private processorAbortController: AbortController | null = null

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async refresh(): Promise<void> {
    const db = await getTetherDb()
    const rows = await db.getAllFromIndex('nl_input_queue', NL_QUEUE_INDEXES.byCreatedAt)
    runInAction(() => {
      this.items = rows
      this.loaded = true
    })
  }

  async enqueue(text: string, context: string | null = null): Promise<NlQueueItem> {
    const now = new Date().toISOString()
    const db = await getTetherDb()

    const item: NlQueueItem = {
      input_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      text,
      context,
      status: 'pending',
      position: this.items.length,
      estimated_seconds: this.getEstimatedWaitTime(),
      result: null,
      error: null,
    }

    await db.put('nl_input_queue', item)
    await this.refresh()

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessor()
    }

    return item
  }

  async setStatus(inputId: string, status: NlQueueStatus, patch?: Partial<NlQueueItem>): Promise<void> {
    const db = await getTetherDb()
    const existing = await db.get('nl_input_queue', inputId)
    if (!existing) return
    await db.put('nl_input_queue', { ...existing, ...patch, status, updated_at: new Date().toISOString() })
    await this.refresh()
  }

  async cancel(inputId: string): Promise<void> {
    await this.setStatus(inputId, 'canceled')

    // If this was the currently processing item, abort the processor
    const item = this.items.find((i) => i.input_id === inputId)
    if (item?.status === 'processing') {
      this.processorAbortController?.abort()
    }
  }

  async retry(inputId: string): Promise<void> {
    const db = await getTetherDb()
    const existing = await db.get('nl_input_queue', inputId)
    if (!existing) return

    await db.put('nl_input_queue', {
      ...existing,
      status: 'pending',
      error: null,
      result: null,
      updated_at: new Date().toISOString(),
    })

    await this.refresh()

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessor()
    }
  }

  /**
   * Compute estimated wait time based on moving average of recent processing durations
   */
  getEstimatedWaitTime(): number | null {
    if (this.processingDurations.length === 0) {
      return null
    }

    const avg =
      this.processingDurations.reduce((sum, duration) => sum + duration, 0) / this.processingDurations.length

    const pendingAhead = this.items.filter((i) => i.status === 'pending').length

    return Math.round(avg * (pendingAhead + 1))
  }

  /**
   * Add a processing duration to the moving average
   */
  private recordDuration(durationSeconds: number): void {
    this.processingDurations.push(durationSeconds)
    if (this.processingDurations.length > MOVING_AVERAGE_WINDOW) {
      this.processingDurations.shift()
    }
  }

  /**
   * Start the sequential queue processor
   * Only one item is processed at a time
   */
  startProcessor(): void {
    if (this.isProcessing) {
      return
    }

    runInAction(() => {
      this.isProcessing = true
    })

    this.processorAbortController = new AbortController()
    this.processQueue(this.processorAbortController.signal).catch((error) => {
      console.error('Queue processor error:', error)
    })
  }

  /**
   * Stop the queue processor
   */
  stopProcessor(): void {
    this.processorAbortController?.abort()
    runInAction(() => {
      this.isProcessing = false
    })
  }

  /**
   * Sequential queue processing loop
   */
  private async processQueue(signal: AbortSignal): Promise<void> {
    try {
      while (!signal.aborted) {
        await this.refresh()

        const pendingItem = this.items.find((i) => i.status === 'pending')

        if (!pendingItem) {
          // No more pending items, stop processing
          break
        }

        // Process this item
        await this.processItem(pendingItem, signal)

        if (signal.aborted) {
          break
        }
      }
    } finally {
      runInAction(() => {
        this.isProcessing = false
      })
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: NlQueueItem, signal: AbortSignal): Promise<void> {
    const startTime = Date.now()

    try {
      // Mark as processing
      await this.setStatus(item.input_id, 'processing')

      if (signal.aborted) {
        await this.setStatus(item.input_id, 'canceled')
        return
      }

      // Call LLM service
      const llmClient = getLlmClient()
      const response: ClassifiedExtractionResponse = await llmClient.extract({
        text: item.text,
        context: item.context,
        sync_to_db: false, // We handle staging locally
      })

      if (signal.aborted) {
        await this.setStatus(item.input_id, 'canceled')
        return
      }

      // Map extraction to staged rows
      const stagedIds = await mapExtractionToStagedRows(item.input_id, response, null)

      // Mark as completed with result
      await this.setStatus(item.input_id, 'completed', {
        result: {
          classification: response.classification,
          chain_of_thought: response.chain_of_thought,
          staged_ids: stagedIds,
          resolutions: response.extraction.resolutions,
          clarifications: response.extraction.clarifications,
        },
      })

      // Record processing duration
      const durationMs = Date.now() - startTime
      const durationSeconds = Math.round(durationMs / 1000)
      runInAction(() => {
        this.recordDuration(durationSeconds)
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.setStatus(item.input_id, 'failed', {
        error: errorMessage,
      })
    }
  }

  /**
   * Get pending queue items with their position and estimated wait time
   */
  get pendingQueue(): Array<NlQueueItem & { queuePosition: number; estimatedWaitSeconds: number | null }> {
    const pending = this.items.filter((i) => i.status === 'pending')
    const avgDuration =
      this.processingDurations.length > 0
        ? this.processingDurations.reduce((sum, d) => sum + d, 0) / this.processingDurations.length
        : null

    return pending.map((item, index) => ({
      ...item,
      queuePosition: index + 1,
      estimatedWaitSeconds: avgDuration ? Math.round(avgDuration * (index + 1)) : null,
    }))
  }

  /**
   * Get the currently processing item
   */
  get currentlyProcessing(): NlQueueItem | null {
    return this.items.find((i) => i.status === 'processing') ?? null
  }

  /**
   * Get completed items
   */
  get completed(): NlQueueItem[] {
    return this.items.filter((i) => i.status === 'completed')
  }

  /**
   * Get failed items
   */
  get failed(): NlQueueItem[] {
    return this.items.filter((i) => i.status === 'failed')
  }
}
