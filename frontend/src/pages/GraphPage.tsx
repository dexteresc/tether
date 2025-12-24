import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useRootStore } from '../stores/RootStore'
import type { Entity, Relation } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

// We'll import the graph library dynamically after we add the dependency
// For now, we'll create a placeholder that shows the data structure

interface GraphNode {
  id: string
  label: string
  type: string
}

interface GraphLink {
  source: string
  target: string
  label: string
  strength?: number
}

export const GraphPage = observer(function GraphPage() {
  const { replica } = useRootStore()
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const entities = await replica.listByUpdatedAt('entities', 1000)
        const relations = await replica.listByUpdatedAt('relations', 1000)
        const identifiers = await replica.listByUpdatedAt('identifiers', 10000)

        // Create a map of entity IDs to their primary identifier (for labels)
        const entityLabels: Record<string, string> = {}
        for (const id of identifiers) {
          if (!entityLabels[id.entity_id]) {
            entityLabels[id.entity_id] = id.value
          }
        }

        // Build nodes from entities
        const graphNodes: GraphNode[] = entities.map((entity: ReplicaRow<Entity>) => ({
          id: entity.id,
          label: entityLabels[entity.id] || entity.id.slice(0, 8),
          type: entity.type,
        }))

        // Build links from relations
        const graphLinks: GraphLink[] = relations.map((relation: ReplicaRow<Relation>) => ({
          source: relation.source_id,
          target: relation.target_id,
          label: relation.type,
          strength: relation.strength ?? undefined,
        }))

        setNodes(graphNodes)
        setLinks(graphLinks)
      } catch (error) {
        console.error('Failed to load graph data:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [replica])

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Relationship Graph</h2>
        <p>Loading graph data...</p>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Relationship Graph</h2>
        <p style={{ color: '#6b7280' }}>No entities or relations to visualize.</p>
      </div>
    )
  }

  // Placeholder UI until we add the force graph library
  return (
    <div style={{ padding: 24 }}>
      <h2>Relationship Graph</h2>
      <div style={{ marginBottom: 16, color: '#6b7280' }}>
        <p>Graph visualization ready. Install react-force-graph-2d to enable interactive visualization.</p>
        <p>
          Nodes: {nodes.length} | Links: {links.length}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Entities ({nodes.length})</h3>
          <div style={{ maxHeight: 400, overflowY: 'auto', fontSize: 13 }}>
            {nodes.slice(0, 50).map((node) => (
              <div
                key={node.id}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontFamily: 'monospace' }}>{node.label}</span>
                <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{node.type}</span>
              </div>
            ))}
            {nodes.length > 50 && (
              <div style={{ padding: 8, color: '#6b7280', textAlign: 'center' }}>
                +{nodes.length - 50} more
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Relations ({links.length})</h3>
          <div style={{ maxHeight: 400, overflowY: 'auto', fontSize: 13 }}>
            {links.slice(0, 50).map((link, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                  {typeof link.source === 'string' ? link.source.slice(0, 8) : ''} →{' '}
                  {typeof link.target === 'string' ? link.target.slice(0, 8) : ''}
                </div>
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ textTransform: 'capitalize' }}>{link.label}</span>
                  {link.strength && <span style={{ color: '#6b7280' }}>Strength: {link.strength}</span>}
                </div>
              </div>
            ))}
            {links.length > 50 && (
              <div style={{ padding: 8, color: '#6b7280', textAlign: 'center' }}>
                +{links.length - 50} more
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
