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
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Natural Language Input</h1>

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Enter intelligence text:</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Example: John Doe met Jane Smith at the Hilton Hotel on March 15, 2024..."
            style={{
              width: '100%',
              minHeight: 120,
              padding: 12,
              fontSize: 14,
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!inputText.trim() || nlQueue.isProcessing}
          style={{
            padding: '8px 24px',
            backgroundColor: inputText.trim() ? '#2563eb' : '#d1d5db',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: inputText.trim() ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Submit
        </button>
      </form>

      {/* Queue Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Processing</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{currentlyProcessing ? 1 : 0}</div>
        </div>
        <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Pending</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{pendingQueue.length}</div>
        </div>
        <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Completed</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{completed.length}</div>
        </div>
        <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Failed</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{failed.length}</div>
        </div>
      </div>

      {/* Currently Processing */}
      {currentlyProcessing && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Currently Processing</h2>
          <div style={{ padding: 16, backgroundColor: '#eff6ff', borderRadius: 8, border: '1px solid #2563eb' }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              <strong>Text:</strong> {currentlyProcessing.text.substring(0, 100)}
              {currentlyProcessing.text.length > 100 ? '...' : ''}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Processing...</div>
          </div>
        </div>
      )}

      {/* Pending Queue */}
      {pendingQueue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Pending Queue</h2>
          {pendingQueue.map((item) => (
            <div
              key={item.input_id}
              style={{
                padding: 16,
                backgroundColor: '#f9fafb',
                borderRadius: 8,
                marginBottom: 8,
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>
                    <strong>Position {item.queuePosition}:</strong> {item.text.substring(0, 80)}
                    {item.text.length > 80 ? '...' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Estimated wait: {formatDuration(item.estimatedWaitSeconds)}
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(item.input_id)}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#b91c1c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
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
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Completed Extractions</h2>
          {completed.map((item) => (
            <div
              key={item.input_id}
              style={{
                padding: 16,
                backgroundColor: selectedInputId === item.input_id ? '#f0fdf4' : '#fff',
                borderRadius: 8,
                marginBottom: 8,
                border: `1px solid ${selectedInputId === item.input_id ? '#059669' : '#e5e7eb'}`,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedInputId(item.input_id)}
            >
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                <strong>Text:</strong> {item.text.substring(0, 100)}
                {item.text.length > 100 ? '...' : ''}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Failed Items */}
      {failed.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Failed Extractions</h2>
          {failed.map((item) => (
            <div
              key={item.input_id}
              style={{
                padding: 16,
                backgroundColor: '#fee2e2',
                borderRadius: 8,
                marginBottom: 8,
                border: '1px solid #b91c1c',
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                <strong>Text:</strong> {item.text.substring(0, 100)}
                {item.text.length > 100 ? '...' : ''}
              </div>
              <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>
                <strong>Error:</strong> {item.error}
              </div>
              <button
                onClick={() => handleRetry(item.input_id)}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Retry
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Staged Rows Review */}
      {selectedInputId && stagedRows.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Review Extracted Data</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSelectedInputId(null)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Close
              </button>
              <button
                onClick={handleCommit}
                disabled={isCommitting}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: isCommitting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {isCommitting ? 'Committing...' : 'Commit to Database'}
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
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
