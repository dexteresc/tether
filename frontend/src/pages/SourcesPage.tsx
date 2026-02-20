import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useRootStore } from '../stores/RootStore'
import { TableView, type Column } from '../components/TableView'
import type { Source } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

export const SourcesPage = observer(function SourcesPage() {
  const { replica } = useRootStore()
  const [sources, setSources] = useState<Array<ReplicaRow<Source>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await replica.listByUpdatedAt('sources', 1000)
        setSources(data)
      } catch (error) {
        console.error('Failed to load sources:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [replica])

  const columns: Array<Column<ReplicaRow<Source>>> = [
    {
      key: 'code',
      label: 'Code',
      width: '120px',
      render: (row) => (
        <span className="font-mono font-semibold">{row.code}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '140px',
      render: (row) => (
        <span className="capitalize">{row.type}</span>
      ),
    },
    {
      key: 'reliability',
      label: 'Reliability',
      width: '120px',
      render: (row) => {
        const colors: Record<string, string> = {
          A: 'text-emerald-600',
          B: 'text-emerald-500',
          C: 'text-lime-500',
          D: 'text-amber-500',
          E: 'text-orange-500',
          F: 'text-red-600',
        }
        return (
          <span
            className={`${colors[row.reliability] || 'text-gray-700'} font-semibold text-base`}
          >
            {row.reliability}
          </span>
        )
      },
    },
    {
      key: 'active',
      label: 'Active',
      width: '100px',
      render: (row) => (
        <span className={row.active ? 'text-emerald-600' : 'text-gray-400'}>
          {row.active ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '180px',
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ]

  return (
    <div>
      <div className="p-4 border-b border-gray-200">
        <h2 className="m-0 mb-4 text-xl font-bold">Sources</h2>
      </div>
      <TableView
        columns={columns}
        data={sources}
        loading={loading}
        emptyMessage="No sources found."
      />
    </div>
  )
})