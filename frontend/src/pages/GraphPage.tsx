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
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Relationship Graph</h2>
        <p>Loading graph data...</p>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Relationship Graph</h2>
        <p className="text-gray-500">No entities or relations to visualize.</p>
      </div>
    )
  }

  // Placeholder UI until we add the force graph library
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Relationship Graph</h2>
      <div className="mb-4 text-gray-500">
        <p>Graph visualization ready. Install react-force-graph-2d to enable interactive visualization.</p>
        <p>
          Nodes: {nodes.length} | Links: {links.length}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="mt-0 text-lg font-bold mb-2">Entities ({nodes.length})</h3>
          <div className="max-h-[400px] overflow-y-auto text-sm border border-gray-200 rounded">
            {nodes.slice(0, 50).map((node) => (
              <div
                key={node.id}
                className="p-2 border-b border-gray-100 flex justify-between items-center"
              >
                <span className="font-mono">{node.label}</span>
                <span className="text-gray-500 capitalize">{node.type}</span>
              </div>
            ))}
            {nodes.length > 50 && (
              <div className="p-2 text-gray-500 text-center">
                +{nodes.length - 50} more
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mt-0 text-lg font-bold mb-2">Relations ({links.length})</h3>
          <div className="max-h-[400px] overflow-y-auto text-sm border border-gray-200 rounded">
            {links.slice(0, 50).map((link, idx) => (
              <div
                key={idx}
                className="p-2 border-b border-gray-100"
              >
                <div className="font-mono text-xs text-gray-500">
                  {typeof link.source === 'string' ? link.source.slice(0, 8) : ''} →{' '}
                  {typeof link.target === 'string' ? link.target.slice(0, 8) : ''}
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="capitalize">{link.label}</span>
                  {link.strength && <span className="text-gray-500">Strength: {link.strength}</span>}
                </div>
              </div>
            ))}
            {links.length > 50 && (
              <div className="p-2 text-gray-500 text-center">
                +{links.length - 50} more
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})