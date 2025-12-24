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

  const getStatusColorClass = () => {
    switch (staged.status) {
      case 'proposed':
        return 'bg-amber-500'
      case 'accepted':
      case 'edited':
        return 'bg-emerald-600'
      case 'rejected':
        return 'bg-red-700'
      default:
        return 'bg-gray-500'
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
    <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-white">
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-3 items-center">
          <span className="font-semibold text-sm">{getTableLabel(staged.table)}</span>
          <span
            className={`text-xs text-white px-2 py-0.5 rounded ${getStatusColorClass()}`}
          >
            {staged.status}
          </span>
          {staged.origin_label && (
            <span className="text-xs text-gray-500">({staged.origin_label})</span>
          )}
        </div>

        {!isEditing && (
          <div className="flex gap-2">
            {(staged.status === 'proposed' || staged.status === 'edited') && (
              <>
                <button
                  onClick={handleAccept}
                  className="px-3 py-1 bg-emerald-600 text-white border-none rounded cursor-pointer text-xs hover:bg-emerald-700"
                >
                  Accept
                </button>
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 bg-blue-600 text-white border-none rounded cursor-pointer text-xs hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={handleReject}
                  className="px-3 py-1 bg-red-700 text-white border-none rounded cursor-pointer text-xs hover:bg-red-800"
                >
                  Reject
                </button>
              </>
            )}
            {staged.status === 'accepted' && (
              <button
                onClick={handleReject}
                className="px-3 py-1 bg-gray-500 text-white border-none rounded cursor-pointer text-xs hover:bg-gray-600"
              >
                Undo
              </button>
            )}
            {staged.status === 'rejected' && (
              <button
                onClick={handleAccept}
                className="px-3 py-1 bg-gray-500 text-white border-none rounded cursor-pointer text-xs hover:bg-gray-600"
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
            className="w-full min-h-[200px] font-mono text-xs p-2 border border-gray-300 rounded"
          />
          {validationErrors.length > 0 && (
            <div className="mt-2 p-2 bg-red-100 rounded">
              <strong className="text-red-700 text-xs font-bold">Validation errors:</strong>
              <ul className="m-0 mt-1 pl-5 text-xs text-red-700">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>
                    {err.field !== '_root' && <strong>{err.field}:</strong>} {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="px-4 py-1.5 bg-emerald-600 text-white border-none rounded cursor-pointer text-sm hover:bg-emerald-700"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-1.5 bg-gray-500 text-white border-none rounded cursor-pointer text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto m-0">
          {JSON.stringify(staged.proposed_row, null, 2)}
        </pre>
      )}
    </div>
  )
})