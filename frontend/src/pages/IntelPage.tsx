import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useRootStore } from '../stores/RootStore'
import { TableView, type Column } from '../components/TableView'
import type { Intel } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

export const IntelPage = observer(function IntelPage() {
  const { replica } = useRootStore()
  const [intel, setIntel] = useState<Array<ReplicaRow<Intel>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await replica.listByUpdatedAt('intel', 1000)
        setIntel(data)
      } catch (error) {
        console.error('Failed to load intel:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [replica])

  const columns: Array<Column<ReplicaRow<Intel>>> = [
    {
      key: 'occurred_at',
      label: 'Occurred',
      width: '180px',
      render: (row) => new Date(row.occurred_at).toLocaleString(),
    },
    {
      key: 'type',
      label: 'Type',
      width: '140px',
      render: (row) => (
        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{row.type}</span>
      ),
    },
    {
      key: 'confidence',
      label: 'Confidence',
      width: '120px',
      render: (row) => {
        const colors: Record<string, string> = {
          confirmed: '#059669',
          high: '#10b981',
          medium: '#f59e0b',
          low: '#f97316',
          unconfirmed: '#6b7280',
        }
        return (
          <span
            style={{
              color: colors[row.confidence] || '#374151',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {row.confidence}
          </span>
        )
      },
    },
    {
      key: 'source_id',
      label: 'Source',
      width: '200px',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {row.source_id ? row.source_id.slice(0, 8) + '...' : 'N/A'}
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
        <h2 style={{ margin: 0, marginBottom: 16 }}>Intel</h2>
      </div>
      <TableView
        columns={columns}
        data={intel}
        loading={loading}
        emptyMessage="No intel records found."
      />
    </div>
  )
})
