import { observer } from 'mobx-react-lite'
import { useState } from 'react'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  width?: string
}

interface TableViewProps<T> {
  columns: Array<Column<T>>
  data: T[]
  loading?: boolean
  onRowClick?: (row: T) => void
  emptyMessage?: string
  pageSize?: number
}

export const TableView = observer(function TableView<T>({
  columns,
  data,
  loading = false,
  onRowClick,
  emptyMessage = 'No data available',
  pageSize = 50,
}: TableViewProps<T>) {
  const [currentPage, setCurrentPage] = useState(0)

  const totalPages = Math.ceil(data.length / pageSize)
  const startIndex = currentPage * pageSize
  const endIndex = Math.min(startIndex + pageSize, data.length)
  const currentData = data.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 600,
                    width: col.width,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: '1px solid #e5e7eb',
                  cursor: onRowClick ? 'pointer' : 'default',
                  backgroundColor: 'white',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '12px 8px' }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            Showing {startIndex + 1}-{endIndex} of {data.length}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => goToPage(0)} disabled={currentPage === 0}>
              First
            </button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0}>
              Previous
            </button>
            <span style={{ padding: '0 8px', fontSize: 14, color: '#374151' }}>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages - 1}>
              Next
            </button>
            <button onClick={() => goToPage(totalPages - 1)} disabled={currentPage === totalPages - 1}>
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
