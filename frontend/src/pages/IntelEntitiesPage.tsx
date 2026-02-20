import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useRootStore } from '../stores/RootStore'
import { TableView, type Column } from '../components/TableView'
import type { IntelEntity } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

export const IntelEntitiesPage = observer(function IntelEntitiesPage() {
  const { replica } = useRootStore()
  const [intelEntities, setIntelEntities] = useState<Array<ReplicaRow<IntelEntity>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await replica.listByUpdatedAt('intel_entities', 1000)
        setIntelEntities(data)
      } catch (error) {
        console.error('Failed to load intel entities:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [replica])

  const columns: Array<Column<ReplicaRow<IntelEntity>>> = [
    {
      key: 'intel_id',
      label: 'Intel',
      width: '160px',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.intel_id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: 'entity_id',
      label: 'Entity',
      width: '160px',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.entity_id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <span className="capitalize">
          {row.role || 'N/A'}
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
        <h2 className="m-0 mb-4 text-xl font-bold">Intel-Entity Relationships</h2>
      </div>
      <TableView
        columns={columns}
        data={intelEntities}
        loading={loading}
        emptyMessage="No intel-entity relationships found."
      />
    </div>
  )
})