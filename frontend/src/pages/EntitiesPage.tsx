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
        <span className="capitalize font-medium">{row.type}</span>
      ),
    },
    {
      key: 'identifiers',
      label: 'Identifiers',
      render: (row) => {
        const ids = identifiersMap[row.id] || []
        if (ids.length === 0) return <span className="text-gray-400">No identifiers</span>
        return (
          <div className="flex flex-wrap gap-1">
            {ids.slice(0, 3).map((id) => (
              <span
                key={id.id}
                className="px-2 py-0.5 bg-gray-200 rounded text-xs font-mono"
              >
                {id.type}: {id.value}
              </span>
            ))}
            {ids.length > 3 && (
              <span className="text-xs text-gray-500">+{ids.length - 3} more</span>
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
      <div className="p-4 border-b border-gray-200">
        <h2 className="m-0 mb-4 text-xl font-bold">Entities</h2>
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