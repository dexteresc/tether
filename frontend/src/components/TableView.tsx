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
      <div className="p-6 text-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="p-3 text-left font-semibold"
                  style={{ width: col.width }}
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
                className={`border-b border-gray-200 bg-white ${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="p-3">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1}-{endIndex} of {data.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(0)}
              disabled={currentPage === 0}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              First
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2 text-sm text-gray-700 flex items-center">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              Next
            </button>
            <button
              onClick={() => goToPage(totalPages - 1)}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  )
})