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
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.code}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '140px',
      render: (row) => (
        <span style={{ textTransform: 'capitalize' }}>{row.type}</span>
      ),
    },
    {
      key: 'reliability',
      label: 'Reliability',
      width: '120px',
      render: (row) => {
        const colors: Record<string, string> = {
          A: '#059669',
          B: '#10b981',
          C: '#84cc16',
          D: '#f59e0b',
          E: '#f97316',
          F: '#dc2626',
        }
        return (
          <span
            style={{
              color: colors[row.reliability] || '#374151',
              fontWeight: 600,
              fontSize: 16,
            }}
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
        <span style={{ color: row.active ? '#059669' : '#9ca3af' }}>
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
      <div style={{ padding: '16px 16px 0 16px', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: 0, marginBottom: 16 }}>Sources</h2>
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
