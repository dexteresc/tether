import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRootStore } from '../stores/RootStore'
import { TableView, type Column } from '../components/TableView'
import type { Entity, Identifier } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

type EntityRow = ReplicaRow<Entity> & { identifiers?: Identifier[] }

export const EntitiesPage = observer(function EntitiesPage() {
  const { replica } = useRootStore()
  const navigate = useNavigate()
  const [entities, setEntities] = useState<EntityRow[]>([])
  const [identifiersMap, setIdentifiersMap] = useState<Record<string, Identifier[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const entitiesData = await replica.listByUpdatedAt('entities', 1000)
        const identifiersData = await replica.listByUpdatedAt('identifiers', 10000)

        // Group identifiers by entity_id
        const idMap: Record<string, Identifier[]> = {}
        for (const id of identifiersData) {
          if (!idMap[id.entity_id]) {
            idMap[id.entity_id] = []
          }
          idMap[id.entity_id].push(id)
        }

        setIdentifiersMap(idMap)
        setEntities(entitiesData as EntityRow[])
      } catch (error) {
        console.error('Failed to load entities:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [replica])

  const columns: Array<Column<EntityRow>> = [
    {
      key: 'type',
      label: 'Type',
      width: '120px',
      render: (row) => (
        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{row.type}</span>
      ),
    },
    {
      key: 'identifiers',
      label: 'Identifiers',
      render: (row) => {
        const ids = identifiersMap[row.id] || []
        if (ids.length === 0) return <span style={{ color: '#9ca3af' }}>No identifiers</span>
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ids.slice(0, 3).map((id) => (
              <span
                key={id.id}
                style={{
                  padding: '2px 8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: 3,
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              >
                {id.type}: {id.value}
              </span>
            ))}
            {ids.length > 3 && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>+{ids.length - 3} more</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '180px',
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      width: '180px',
      render: (row) => new Date(row.updated_at).toLocaleString(),
    },
  ]

  return (
    <div>
      <div style={{ padding: '16px 16px 0 16px', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: 0, marginBottom: 16 }}>Entities</h2>
      </div>
      <TableView
        columns={columns}
        data={entities}
        loading={loading}
        onRowClick={(row) => navigate(`/entities/${row.id}`)}
        emptyMessage="No entities found. Create one using Natural Language Input."
      />
    </div>
  )
})
