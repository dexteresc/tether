import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import type { StagedExtraction, TableName } from '../lib/sync/types'
import { updateStagedExtraction } from '../lib/idb/staged'
import { validateProposedRow, type ValidationError } from '../services/validation/dbValidation'

interface StagedRowEditorProps {
  staged: StagedExtraction
  onStatusChange?: () => void
}

export const StagedRowEditor = observer(function StagedRowEditor({ staged, onStatusChange }: StagedRowEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedRow, setEditedRow] = useState<string>(JSON.stringify(staged.proposed_row, null, 2))
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  const handleAccept = async () => {
    await updateStagedExtraction(staged.staged_id, { status: 'accepted', validation_errors: null })
    onStatusChange?.()
  }

  const handleReject = async () => {
    await updateStagedExtraction(staged.staged_id, { status: 'rejected', validation_errors: null })
    onStatusChange?.()
  }

  const handleEdit = () => {
    setIsEditing(true)
    setValidationErrors([])
  }

  const handleSaveEdit = async () => {
    try {
      const parsedRow = JSON.parse(editedRow)

      // Validate the edited row
      const errors = validateProposedRow(staged.table, parsedRow)

      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }

      // Save the edited row
      await updateStagedExtraction(staged.staged_id, {
        proposed_row: parsedRow,
        status: 'edited',
        validation_errors: null,
      })

      setIsEditing(false)
      setValidationErrors([])
      onStatusChange?.()
    } catch {
      setValidationErrors([{ field: '_root', message: 'Invalid JSON format' }])
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedRow(JSON.stringify(staged.proposed_row, null, 2))
    setValidationErrors([])
  }

  const getStatusColor = () => {
    switch (staged.status) {
      case 'proposed':
        return '#f59e0b'
      case 'accepted':
      case 'edited':
        return '#059669'
      case 'rejected':
        return '#b91c1c'
      default:
        return '#6b7280'
    }
  }

  const getTableLabel = (table: TableName): string => {
    const labels: Record<TableName, string> = {
      entities: 'Entity',
      identifiers: 'Identifier',
      relations: 'Relation',
      intel: 'Intel',
      intel_entities: 'Intel-Entity Link',
      sources: 'Source',
    }
    return labels[table] || table
  }

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{getTableLabel(staged.table)}</span>
          <span
            style={{
              fontSize: 12,
              color: '#fff',
              backgroundColor: getStatusColor(),
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {staged.status}
          </span>
          {staged.origin_label && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>({staged.origin_label})</span>
          )}
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: 8 }}>
            {(staged.status === 'proposed' || staged.status === 'edited') && (
              <>
                <button
                  onClick={handleAccept}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={handleEdit}
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
                  Edit
                </button>
                <button
                  onClick={handleReject}
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
                  Reject
                </button>
              </>
            )}
            {staged.status === 'accepted' && (
              <button
                onClick={handleReject}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Undo
              </button>
            )}
            {staged.status === 'rejected' && (
              <button
                onClick={handleAccept}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div>
          <textarea
            value={editedRow}
            onChange={(e) => setEditedRow(e.target.value)}
            style={{
              width: '100%',
              minHeight: 200,
              fontFamily: 'monospace',
              fontSize: 12,
              padding: 8,
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
          {validationErrors.length > 0 && (
            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fee2e2', borderRadius: 4 }}>
              <strong style={{ color: '#b91c1c', fontSize: 12 }}>Validation errors:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 20, fontSize: 12, color: '#b91c1c' }}>
                {validationErrors.map((err, idx) => (
                  <li key={idx}>
                    {err.field !== '_root' && <strong>{err.field}:</strong>} {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveEdit}
              style={{
                padding: '6px 16px',
                backgroundColor: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
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
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre
          style={{
            fontSize: 12,
            backgroundColor: '#f9fafb',
            padding: 12,
            borderRadius: 4,
            overflow: 'auto',
            margin: 0,
          }}
        >
          {JSON.stringify(staged.proposed_row, null, 2)}
        </pre>
      )}
    </div>
  )
})
