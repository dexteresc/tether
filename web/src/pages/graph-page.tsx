import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import type { Entity, Relation } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

interface GraphNode {
  id: string;
  label: string;
  type: string;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  strength?: number;
}

export const GraphPage = observer(function GraphPage() {
  const { replica } = useRootStore();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const entities = await replica.listByUpdatedAt(
          "entities",
          1000
        );
        const relations = await replica.listByUpdatedAt(
          "relations",
          1000
        );
        const identifiers = await replica.listByUpdatedAt(
          "identifiers",
          10000
        );

        const entityLabels: Record<string, string> = {};
        for (const id of identifiers) {
          if (!entityLabels[id.entity_id]) {
            entityLabels[id.entity_id] = id.value;
          }
        }

        const graphNodes: GraphNode[] = entities.map(
          (entity: ReplicaRow<Entity>) => ({
            id: entity.id,
            label:
              entityLabels[entity.id] || entity.id.slice(0, 8),
            type: entity.type,
          })
        );

        const graphLinks: GraphLink[] = relations.map(
          (relation: ReplicaRow<Relation>) => ({
            source: relation.source_id,
            target: relation.target_id,
            label: relation.type,
            strength: relation.strength ?? undefined,
          })
        );

        setNodes(graphNodes);
        setLinks(graphLinks);
      } catch (error) {
        console.error("Failed to load graph data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [replica]);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">
          Relationship Graph
        </h2>
        <p className="text-muted-foreground">
          Loading graph data...
        </p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">
          Relationship Graph
        </h2>
        <p className="text-muted-foreground">
          No entities or relations to visualize.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Relationship Graph</h2>
      <div className="mb-4 text-muted-foreground">
        <p>
          Graph visualization ready. Nodes: {nodes.length} | Links:{" "}
          {links.length}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="mt-0 text-lg font-bold mb-2">
            Entities ({nodes.length})
          </h3>
          <div className="max-h-[400px] overflow-y-auto text-sm border rounded-md">
            {nodes.slice(0, 50).map((node) => (
              <div
                key={node.id}
                className="p-2 border-b flex justify-between items-center"
              >
                <span className="font-mono">{node.label}</span>
                <span className="text-muted-foreground capitalize">
                  {node.type}
                </span>
              </div>
            ))}
            {nodes.length > 50 && (
              <div className="p-2 text-muted-foreground text-center">
                +{nodes.length - 50} more
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mt-0 text-lg font-bold mb-2">
            Relations ({links.length})
          </h3>
          <div className="max-h-[400px] overflow-y-auto text-sm border rounded-md">
            {links.slice(0, 50).map((link, idx) => (
              <div key={idx} className="p-2 border-b">
                <div className="font-mono text-xs text-muted-foreground">
                  {typeof link.source === "string"
                    ? link.source.slice(0, 8)
                    : ""}{" "}
                  &rarr;{" "}
                  {typeof link.target === "string"
                    ? link.target.slice(0, 8)
                    : ""}
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="capitalize">{link.label}</span>
                  {link.strength && (
                    <span className="text-muted-foreground">
                      Strength: {link.strength}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {links.length > 50 && (
              <div className="p-2 text-muted-foreground text-center">
                +{links.length - 50} more
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
