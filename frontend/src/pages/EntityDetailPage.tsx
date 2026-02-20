import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRootStore } from '../stores/RootStore'
import { IdentifierGroups } from '../components/IdentifierGroups'
import type { Entity, Identifier } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

export const EntityDetailPage = observer(function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { replica } = useRootStore()
  const [entity, setEntity] = useState<ReplicaRow<Entity> | null>(null)
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!id) return

      setLoading(true)
      try {
        const entityData = await replica.getById('entities', id)
        if (entityData) {
          setEntity(entityData)
        }

        // Load all identifiers and filter by entity_id
        const identifiersData = await replica.listByUpdatedAt('identifiers', 10000)
        const entityIdentifiers = identifiersData.filter((i) => i.entity_id === id)
        setIdentifiers(entityIdentifiers)
      } catch (error) {
        console.error('Failed to load entity:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, replica])

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    )
  }

  if (!entity) {
    return (
      <div className="p-6">
        <p>Entity not found</p>
        <Link to="/entities" className="text-blue-600 hover:underline">Back to Entities</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="p-4 border-b border-gray-200">
        <Link to="/entities" className="text-sm text-blue-600 hover:underline">
          ← Back to Entities
        </Link>
        <h2 className="m-0 mt-2 text-xl font-bold">Entity Detail</h2>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="font-semibold text-gray-700">ID:</div>
            <div className="font-mono text-[13px]">{entity.id}</div>

            <div className="font-semibold text-gray-700">Type:</div>
            <div className="capitalize">{entity.type}</div>

            <div className="font-semibold text-gray-700">Created:</div>
            <div>{new Date(entity.created_at).toLocaleString()}</div>

            <div className="font-semibold text-gray-700">Updated:</div>
            <div>{new Date(entity.updated_at).toLocaleString()}</div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="mt-0 mb-3 text-lg font-bold">Identifiers</h3>
          <IdentifierGroups identifiers={identifiers} />
        </div>

        {entity.data && typeof entity.data === 'object' && Object.keys(entity.data).length > 0 && (
          <div>
            <h3 className="mt-0 mb-3 text-lg font-bold">Additional Data</h3>
            <pre className="p-3 bg-gray-50 border border-gray-200 rounded text-xs overflow-auto">
              {JSON.stringify(entity.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
})