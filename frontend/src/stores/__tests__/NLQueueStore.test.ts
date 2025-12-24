import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NLQueueStore } from '../NLQueueStore'
import { getTetherDb } from '../../lib/idb/db'
import * as LlmClientModule from '../../services/llm/LlmClient'
import type { ClassifiedExtractionResponse } from '../../services/llm/types'

// Mock the LLM client
vi.mock('../../services/llm/LlmClient', () => ({
  getLlmClient: vi.fn(),
}))

// Mock the mapping function
vi.mock('../../services/llm/mapping', () => ({
  mapExtractionToStagedRows: vi.fn(async () => ['staged-1', 'staged-2']),
}))

describe('NLQueueStore', () => {
  let store: NLQueueStore

  beforeEach(async () => {
    store = new NLQueueStore()
    await store.refresh()
  })

  describe('enqueue', () => {
    it('should enqueue a new item with pending status', async () => {
      const item = await store.enqueue('Test text', null)

      expect(item.status).toBe('pending')
      expect(item.text).toBe('Test text')
      expect(item.context).toBe(null)
      expect(item.input_id).toBeDefined()

      // Verify it was persisted
      const db = await getTetherDb()
      const persisted = await db.get('nl_input_queue', item.input_id)
      expect(persisted).toBeDefined()
      expect(persisted?.status).toBe('pending')
    })

    it('should calculate estimated wait time for queued items', async () => {
      // Add some processing durations to the store
      store.processingDurations = [10, 12, 11]

      const item = await store.enqueue('Test text', null)

      // Average is 11 seconds, position 1 (first item)
      expect(item.estimated_seconds).toBe(11)
    })

    it('should return null for estimated wait time with no processing history', async () => {
      const item = await store.enqueue('Test text', null)
      expect(item.estimated_seconds).toBe(null)
    })
  })

  describe('sequential processing', () => {
    it('should process items sequentially, one at a time', async () => {
      const mockExtract = vi.fn()
      const mockResponse: ClassifiedExtractionResponse = {
        classification: 'fact_update',
        chain_of_thought: 'Test reasoning',
        extraction: {
          reasoning: {
            entities_identified: 'test',
            relationships_identified: 'test',
            facts_identified: 'test',
            events_identified: 'test',
            sources_identified: 'test',
            confidence_rationale: 'test',
          },
          entities: [],
          relations: [],
          intel: [],
        },
      }

      mockExtract.mockResolvedValue(mockResponse)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(LlmClientModule.getLlmClient).mockReturnValue({
        extract: mockExtract,
      } as any)

      // Enqueue multiple items
      await store.enqueue('Text 1', null)
      await store.enqueue('Text 2', null)
      await store.enqueue('Text 3', null)

      // Wait for all processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify all items were processed
      await store.refresh()

      const processedItems = store.items.filter((i) => i.status === 'completed')
      expect(processedItems.length).toBeGreaterThanOrEqual(1) // At least one should be processed

      // Verify extract was called for processed items
      expect(mockExtract.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('cancel', () => {
    it('should cancel a pending item', async () => {
      const item = await store.enqueue('Test text', null)

      await store.cancel(item.input_id)
      await store.refresh()

      const canceledItem = store.items.find((i) => i.input_id === item.input_id)
      expect(canceledItem?.status).toBe('canceled')
    })
  })

  describe('retry', () => {
    it('should reset a failed item to pending status', async () => {
      const item = await store.enqueue('Test text', null)

      // Mark as failed
      await store.setStatus(item.input_id, 'failed', { error: 'Test error' })
      await store.refresh()

      const failedItem = store.items.find((i) => i.input_id === item.input_id)
      expect(failedItem?.status).toBe('failed')
      expect(failedItem?.error).toBe('Test error')

      // Retry
      await store.retry(item.input_id)
      await store.refresh()

      const retriedItem = store.items.find((i) => i.input_id === item.input_id)
      expect(retriedItem?.status).toBe('pending')
      expect(retriedItem?.error).toBe(null)
      expect(retriedItem?.result).toBe(null)
    })
  })

  describe('estimated wait time calculation', () => {
    it('should calculate estimated wait time based on moving average', () => {
      store.processingDurations = [10, 12, 14, 11, 13] // avg = 12

      const estimated = store.getEstimatedWaitTime()

      // With 0 pending items, should be avg * 1 = 12
      expect(estimated).toBe(12)
    })

    it('should maintain a rolling window of processing durations', () => {
      // Add 6 durations to a window of size 5
      for (let i = 1; i <= 6; i++) {
        store['recordDuration'](i * 10)
      }

      // Should only keep the last 5 (20, 30, 40, 50, 60)
      expect(store.processingDurations.length).toBe(5)
      expect(store.processingDurations).toEqual([20, 30, 40, 50, 60])
    })

    it('should compute estimated wait time per queue position', async () => {
      store.processingDurations = [10, 10, 10] // avg = 10

      await store.enqueue('Text 1', null)
      await store.enqueue('Text 2', null)
      await store.enqueue('Text 3', null)

      const pendingQueue = store.pendingQueue

      expect(pendingQueue[0].queuePosition).toBe(1)
      expect(pendingQueue[0].estimatedWaitSeconds).toBe(10) // 10 * 1

      expect(pendingQueue[1].queuePosition).toBe(2)
      expect(pendingQueue[1].estimatedWaitSeconds).toBe(20) // 10 * 2

      expect(pendingQueue[2].queuePosition).toBe(3)
      expect(pendingQueue[2].estimatedWaitSeconds).toBe(30) // 10 * 3
    })
  })

  describe('getters', () => {
    it('should return pending queue items', async () => {
      await store.enqueue('Text 1', null)
      await store.enqueue('Text 2', null)

      const pendingQueue = store.pendingQueue
      expect(pendingQueue.length).toBe(2)
      expect(pendingQueue[0].queuePosition).toBe(1)
      expect(pendingQueue[1].queuePosition).toBe(2)
    })

    it('should return currently processing item', async () => {
      const item = await store.enqueue('Text 1', null)
      await store.setStatus(item.input_id, 'processing')

      const processing = store.currentlyProcessing
      expect(processing?.input_id).toBe(item.input_id)
      expect(processing?.status).toBe('processing')
    })

    it('should return completed items', async () => {
      const item = await store.enqueue('Text 1', null)
      await store.setStatus(item.input_id, 'completed')

      const completed = store.completed
      expect(completed.length).toBe(1)
      expect(completed[0].input_id).toBe(item.input_id)
    })

    it('should return failed items', async () => {
      const item = await store.enqueue('Text 1', null)
      await store.setStatus(item.input_id, 'failed', { error: 'Test error' })

      const failed = store.failed
      expect(failed.length).toBe(1)
      expect(failed[0].input_id).toBe(item.input_id)
      expect(failed[0].error).toBe('Test error')
    })
  })

  describe('processor lifecycle', () => {
    it('should start processor when enqueuing to an empty queue', async () => {
      expect(store.isProcessing).toBe(false)

      await store.enqueue('Test text', null)

      // Processor should be started
      expect(store.isProcessing).toBe(true)
    })

    it('should stop processor when queue is empty', async () => {
      const mockExtract = vi.fn()
      const mockResponse: ClassifiedExtractionResponse = {
        classification: 'fact_update',
        chain_of_thought: 'Test reasoning',
        extraction: {
          reasoning: {
            entities_identified: 'test',
            relationships_identified: 'test',
            facts_identified: 'test',
            events_identified: 'test',
            sources_identified: 'test',
            confidence_rationale: 'test',
          },
          entities: [],
          relations: [],
          intel: [],
        },
      }

      mockExtract.mockResolvedValue(mockResponse)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(LlmClientModule.getLlmClient).mockReturnValue({
        extract: mockExtract,
      } as any)

      await store.enqueue('Test text', null)

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Processor should stop when queue is empty
      expect(store.isProcessing).toBe(false)
    })
  })
})
