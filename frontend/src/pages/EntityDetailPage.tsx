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
      <div style={{ padding: 24 }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!entity) {
    return (
      <div style={{ padding: 24 }}>
        <p>Entity not found</p>
        <Link to="/entities">Back to Entities</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
        <Link to="/entities" style={{ fontSize: 14, color: '#2563eb' }}>
          ← Back to Entities
        </Link>
        <h2 style={{ margin: '8px 0 0 0' }}>Entity Detail</h2>
      </div>

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <div style={{ fontWeight: 600, color: '#374151' }}>ID:</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{entity.id}</div>

            <div style={{ fontWeight: 600, color: '#374151' }}>Type:</div>
            <div style={{ textTransform: 'capitalize' }}>{entity.type}</div>

            <div style={{ fontWeight: 600, color: '#374151' }}>Created:</div>
            <div>{new Date(entity.created_at).toLocaleString()}</div>

            <div style={{ fontWeight: 600, color: '#374151' }}>Updated:</div>
            <div>{new Date(entity.updated_at).toLocaleString()}</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Identifiers</h3>
          <IdentifierGroups identifiers={identifiers} />
        </div>

        {entity.data && typeof entity.data === 'object' && Object.keys(entity.data).length > 0 && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Additional Data</h3>
            <pre
              style={{
                padding: 12,
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                fontSize: 12,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(entity.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
})
