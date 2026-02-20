import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useRootStore } from '../stores/RootStore'
import { StagedRowEditor } from '../components/StagedRowEditor'
import { getStagedExtractionsByInputId } from '../lib/idb/staged'
import type { StagedExtraction } from '../lib/sync/types'
import { commitStagedForInput } from '../services/sync/stagingToOutbox'

export const NLInputPage = observer(function NLInputPage() {
  const { nlQueue } = useRootStore()
  const [inputText, setInputText] = useState('')
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null)
  const [stagedRows, setStagedRows] = useState<StagedExtraction[]>([])
  const [isCommitting, setIsCommitting] = useState(false)

  useEffect(() => {
    nlQueue.refresh()
  }, [nlQueue])

  useEffect(() => {
    if (selectedInputId) {
      loadStagedRows(selectedInputId)
    } else {
      setStagedRows([])
    }
  }, [selectedInputId])

  const loadStagedRows = async (inputId: string) => {
    const rows = await getStagedExtractionsByInputId(inputId)
    setStagedRows(rows)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputText.trim()) {
      return
    }

    const item = await nlQueue.enqueue(inputText.trim(), null)
    setInputText('')
    setSelectedInputId(item.input_id)
  }

  const handleCancel = async (inputId: string) => {
    if (confirm('Are you sure you want to cancel this item?')) {
      await nlQueue.cancel(inputId)
      if (selectedInputId === inputId) {
        setSelectedInputId(null)
      }
    }
  }

  const handleRetry = async (inputId: string) => {
    await nlQueue.retry(inputId)
  }

  const handleCommit = async () => {
    if (!selectedInputId) return

    const acceptedCount = stagedRows.filter((r) => r.status === 'accepted' || r.status === 'edited').length

    if (acceptedCount === 0) {
      alert('No accepted rows to commit. Please accept at least one row.')
      return
    }

    if (!confirm(`Commit ${acceptedCount} accepted row(s) to the database?`)) {
      return
    }

    setIsCommitting(true)
    try {
      await commitStagedForInput(selectedInputId)
      alert('Successfully committed to outbox. Sync will process these changes.')
      setSelectedInputId(null)
    } catch (error) {
      alert(`Commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCommitting(false)
    }
  }

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return '?'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const currentlyProcessing = nlQueue.currentlyProcessing
  const pendingQueue = nlQueue.pendingQueue
  const completed = nlQueue.completed
  const failed = nlQueue.failed

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Natural Language Input</h1>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-3">
          <label className="block mb-2 font-semibold">Enter intelligence text:</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Example: John Doe met Jane Smith at the Hilton Hotel on March 15, 2024..."
            className="w-full min-h-[120px] p-3 text-sm border border-gray-300 rounded"
          />
        </div>
        <button
          type="submit"
          disabled={!inputText.trim() || nlQueue.isProcessing}
          className={`px-6 py-2 text-white border-none rounded text-sm font-semibold ${
            inputText.trim() ? 'bg-blue-600 cursor-pointer hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Submit
        </button>
      </form>

      {/* Queue Status */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Processing</div>
          <div className="text-2xl font-semibold">{currentlyProcessing ? 1 : 0}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Pending</div>
          <div className="text-2xl font-semibold">{pendingQueue.length}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Completed</div>
          <div className="text-2xl font-semibold">{completed.length}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Failed</div>
          <div className="text-2xl font-semibold">{failed.length}</div>
        </div>
      </div>

      {/* Currently Processing */}
      {currentlyProcessing && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Currently Processing</h2>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-600">
            <div className="text-sm mb-2">
              <strong>Text:</strong> {currentlyProcessing.text.substring(0, 100)}
              {currentlyProcessing.text.length > 100 ? '...' : ''}
            </div>
            <div className="text-xs text-gray-500">Processing...</div>
          </div>
        </div>
      )}

      {/* Pending Queue */}
      {pendingQueue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Pending Queue</h2>
          {pendingQueue.map((item) => (
            <div
              key={item.input_id}
              className="p-4 bg-gray-50 rounded-lg mb-2 border border-gray-200"
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="text-sm mb-1">
                    <strong>Position {item.queuePosition}:</strong> {item.text.substring(0, 80)}
                    {item.text.length > 80 ? '...' : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    Estimated wait: {formatDuration(item.estimatedWaitSeconds)}
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(item.input_id)}
                  className="px-3 py-1 bg-red-700 text-white border-none rounded cursor-pointer text-xs hover:bg-red-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Items */}
      {completed.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Completed Extractions</h2>
          {completed.map((item) => (
            <div
              key={item.input_id}
              className={`p-4 rounded-lg mb-2 border cursor-pointer hover:bg-gray-100 ${
                selectedInputId === item.input_id ? 'bg-green-50 border-emerald-600' : 'bg-white border-gray-200'
              }`}
              onClick={() => setSelectedInputId(item.input_id)}
            >
              <div className="text-sm mb-1">
                <strong>Text:</strong> {item.text.substring(0, 100)}
                {item.text.length > 100 ? '...' : ''}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Failed Items */}
      {failed.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Failed Extractions</h2>
          {failed.map((item) => (
            <div
              key={item.input_id}
              className="p-4 bg-red-100 rounded-lg mb-2 border border-red-700"
            >
              <div className="text-sm mb-1">
                <strong>Text:</strong> {item.text.substring(0, 100)}
                {item.text.length > 100 ? '...' : ''}
              </div>
              <div className="text-xs text-red-700 mb-2">
                <strong>Error:</strong> {item.error}
              </div>
              <button
                onClick={() => handleRetry(item.input_id)}
                className="px-3 py-1 bg-blue-600 text-white border-none rounded cursor-pointer text-xs hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Staged Rows Review */}
      {selectedInputId && stagedRows.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold m-0">Review Extracted Data</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedInputId(null)}
                className="px-4 py-1.5 bg-gray-500 text-white border-none rounded cursor-pointer text-sm hover:bg-gray-600"
              >
                Close
              </button>
              <button
                onClick={handleCommit}
                disabled={isCommitting}
                className={`px-4 py-1.5 bg-emerald-600 text-white border-none rounded text-sm font-semibold ${
                    isCommitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-emerald-700'
                }`}
              >
                {isCommitting ? 'Committing...' : 'Commit to Database'}
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            {stagedRows.filter((r) => r.status === 'accepted' || r.status === 'edited').length} of {stagedRows.length}{' '}
            rows accepted
          </div>

          {stagedRows.map((staged) => (
            <StagedRowEditor
              key={staged.staged_id}
              staged={staged}
              onStatusChange={() => loadStagedRows(selectedInputId)}
            />
          ))}
        </div>
      )}
    </div>
  )
})