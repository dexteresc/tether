import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useRootStore } from "@/stores/RootStore";
import { ENTITY_TYPES } from "@/lib/constants";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ForceGraph2D: any = null;

type Entity = RemoteRow<"entities">;
type Relation = RemoteRow<"relations">;

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  strength?: number;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#8b5cf6",
  group: "#6366f1",
  location: "#10b981",
  event: "#f97316",
  project: "#06b6d4",
  asset: "#ec4899",
};

export const GraphPage = observer(function GraphPage() {
  const { replica } = useRootStore();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [graphReady, setGraphReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [minStrength, setMinStrength] = useState(0);

  // Lazy load the graph component
  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      ForceGraph2D = mod.default;
      setGraphReady(true);
    });
  }, []);

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.height, 400),
        });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [entities, relations, identifiers] = await Promise.all([
          replica.listByUpdatedAt("entities", 10000),
          replica.listByUpdatedAt("relations", 10000),
          replica.listByUpdatedAt("identifiers", 50000),
        ]);

        const entityLabels: Record<string, string> = {};
        for (const id of identifiers) {
          if (id.type === "name" && !entityLabels[id.entity_id]) {
            entityLabels[id.entity_id] = id.value;
          }
        }
        for (const e of entities) {
          if (!entityLabels[e.id]) {
            const data = e.data as Record<string, unknown> | null;
            if (typeof data?.name === "string") {
              entityLabels[e.id] = data.name;
            }
          }
        }

        const activeEntities = entities.filter((e) => !e.deleted_at);
        const activeRelations = relations.filter((r) => !r.deleted_at);

        const graphNodes: GraphNode[] = activeEntities.map(
          (entity: ReplicaRow<Entity>) => ({
            id: entity.id,
            label: entityLabels[entity.id] || entity.id.slice(0, 8),
            type: entity.type,
            val: 1,
          })
        );

        const entityIds = new Set(activeEntities.map((e) => e.id));
        const graphLinks: GraphLink[] = activeRelations
          .filter((r) => entityIds.has(r.source_id) && entityIds.has(r.target_id))
          .map((relation: ReplicaRow<Relation>) => ({
            source: relation.source_id,
            target: relation.target_id,
            label: relation.type,
            strength: relation.strength ?? undefined,
          }));

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

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Filter data
  const filteredNodes = nodes.filter((n) => visibleTypes.has(n.type));
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredLinks = links.filter(
    (l) =>
      filteredNodeIds.has(l.source as string) &&
      filteredNodeIds.has(l.target as string) &&
      (minStrength === 0 || (l.strength && l.strength >= minStrength))
  );

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || "";
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;
      const color = TYPE_COLORS[node.type] || "#888";

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      if (globalScale > 0.6) {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = color;
        ctx.fillText(label, node.x, node.y + 6);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Relationship Graph</h2>
        <p className="text-muted-foreground">Loading graph data...</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Relationship Graph</h2>
        <p className="text-muted-foreground">No entities or relations to visualize.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <h2 className="text-xl font-bold">Relationship Graph</h2>
        <span className="text-sm text-muted-foreground">
          {filteredNodes.length} nodes &middot; {filteredLinks.length} links
        </span>
      </div>

      {/* Controls */}
      <div className="p-3 border-b flex flex-wrap items-center gap-3 flex-shrink-0">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        {ENTITY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
              visibleTypes.has(type) ? "opacity-100" : "opacity-40"
            }`}
            style={{
              backgroundColor: TYPE_COLORS[type] + "20",
              color: TYPE_COLORS[type],
              border: `1px solid ${TYPE_COLORS[type]}`,
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[type] }}
            />
            {type}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-muted-foreground">Min strength:</span>
          <input
            type="range"
            min="0"
            max="10"
            value={minStrength}
            onChange={(e) => setMinStrength(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs w-4">{minStrength}</span>
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 min-h-[400px]">
        {graphReady && ForceGraph2D && (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={{ nodes: filteredNodes, links: filteredLinks }}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              node: any,
              color: string,
              ctx: CanvasRenderingContext2D
            ) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={() => "#88888844"}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              node: any
            ) => {
              if (node.id) navigate(`/entities/${node.id}`);
            }}
            cooldownTicks={100}
          />
        )}
      </div>
    </div>
  );
});
