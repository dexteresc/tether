import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useRootStore } from '../stores/RootStore'
import { TableView, type Column } from '../components/TableView'
import type { Identifier } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

export const IdentifiersPage = observer(function IdentifiersPage() {
  const { replica } = useRootStore()
  const [identifiers, setIdentifiers] = useState<Array<ReplicaRow<Identifier>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await replica.listByUpdatedAt('identifiers', 1000)
        setIdentifiers(data)
      } catch (error) {
        console.error('Failed to load identifiers:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [replica])

  const columns: Array<Column<ReplicaRow<Identifier>>> = [
    {
      key: 'entity_id',
      label: 'Entity',
      width: '160px',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {row.entity_id.slice(0, 8)}...
        </span>
      ),
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
      key: 'value',
      label: 'Value',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 500 }}>
          {row.value}
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
        <h2 style={{ margin: 0, marginBottom: 16 }}>Identifiers</h2>
      </div>
      <TableView
        columns={columns}
        data={identifiers}
        loading={loading}
        emptyMessage="No identifiers found."
      />
    </div>
  )
})
