import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useRootStore } from "@/hooks/use-root-store";
import { ENTITY_TYPES, RELATION_TYPES } from "@/lib/constants";
import { TYPE_COLORS, formatLabel } from "@/lib/utils";
import { EntitySearchInput } from "@/components/entity-search-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getEntityGraphV2,
  getEntityConnectionCounts,
} from "@/lib/supabase-helpers";

let ForceGraph2D: React.ComponentType<Record<string, unknown>> | undefined = undefined;

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  connectionCount?: number;
  isFrontier?: boolean;
  depth?: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  strength?: number;
}

function getLinkNodeId(val: string | GraphNode): string {
  return typeof val === "string" ? val : val.id;
}

export const GraphPage = observer(function GraphPage() {
  useRootStore(); // keep observer reactive
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [graphReady, setGraphReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [visibleRelTypes, setVisibleRelTypes] = useState<Set<string>>(new Set(RELATION_TYPES));
  const [minStrength, setMinStrength] = useState(0);
  const [rootId, setRootId] = useState<string | undefined>(undefined);
  const [, setRootLabel] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [depth, setDepth] = useState(2);

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

  const loadGraph = useCallback(async (entityId: string, graphDepth: number, existingNodes?: GraphNode[], existingLinks?: GraphLink[]) => {
    setLoading(true);
    try {
      const relationTypesFilter = visibleRelTypes.size < RELATION_TYPES.length ? Array.from(visibleRelTypes) : undefined;
      const data = await getEntityGraphV2(
        entityId,
        graphDepth,
        relationTypesFilter,
        minStrength > 0 ? minStrength : undefined
      );

      if (!data || data.length === 0) {
        if (!existingNodes) {
          setNodes([]);
          setLinks([]);
        }
        return;
      }

      // Build node and link maps from returned data
      // data is flat rows from get_entity_graph_v2: one row per discovered entity
      // with relation_source_id/relation_target_id for the edge that discovered it
      const nodeMap = new Map<string, GraphNode>();
      const linkSet = new Set<string>();
      const newLinks: GraphLink[] = [...(existingLinks ?? [])];

      // Add existing nodes
      for (const n of existingNodes ?? []) {
        nodeMap.set(n.id, n);
      }

      for (const row of data) {
        const entityData = typeof row.entity_data === "object" && row.entity_data !== null && !Array.isArray(row.entity_data)
          ? row.entity_data
          : undefined;

        // Add this entity as a node
        if (!nodeMap.has(row.entity_id)) {
          const name = entityData && typeof entityData.name === "string" ? entityData.name : undefined;
          nodeMap.set(row.entity_id, {
            id: row.entity_id,
            label: name ?? row.entity_id.slice(0, 8),
            type: row.entity_type,
            val: 1,
            depth: row.depth,
          });
        }

        // Add link from the relation that discovered this entity
        if (row.relation_source_id && row.relation_target_id && row.relation_type) {
          const linkKey = `${row.relation_source_id}-${row.relation_target_id}-${row.relation_type}`;
          const linkKeyReverse = `${row.relation_target_id}-${row.relation_source_id}-${row.relation_type}`;
          if (!linkSet.has(linkKey) && !linkSet.has(linkKeyReverse)) {
            linkSet.add(linkKey);
            newLinks.push({
              source: row.relation_source_id,
              target: row.relation_target_id,
              label: row.relation_type,
              strength: row.relation_strength ?? undefined,
            });
          }
        }
      }

      // Deduplicate links
      const uniqueLinks = new Map<string, GraphLink>();
      for (const l of newLinks) {
        const src = getLinkNodeId(l.source);
        const tgt = getLinkNodeId(l.target);
        const key = `${src}-${tgt}-${l.label}`;
        if (!uniqueLinks.has(key)) {
          uniqueLinks.set(key, l);
        }
      }

      // Mark frontier nodes (at max depth, not yet expanded)
      const newExpandedIds = new Set(expandedIds);
      newExpandedIds.add(entityId);
      setExpandedIds(newExpandedIds);

      const allNodes = Array.from(nodeMap.values()).map((n) => ({
        ...n,
        isFrontier: !newExpandedIds.has(n.id) && (n.depth ?? 0) >= graphDepth,
      }));

      // Fetch connection counts for all nodes
      const nodeIds = allNodes.map((n) => n.id);
      try {
        const counts = await getEntityConnectionCounts(nodeIds);
        const countMap = new Map<string, number>();
        for (const c of counts) {
          if (c.id && typeof c.connections === "number") {
            countMap.set(c.id, c.connections);
          }
        }
        for (const n of allNodes) {
          n.connectionCount = countMap.get(n.id) ?? 0;
        }
      } catch {
        // Connection counts are optional, continue without them
      }

      setNodes(allNodes);
      setLinks(Array.from(uniqueLinks.values()));
    } catch (error) {
      console.error("Failed to load graph data:", error);
    } finally {
      setLoading(false);
    }
  }, [expandedIds, minStrength, visibleRelTypes]);

  // Load graph when root changes
  useEffect(() => {
    if (rootId) {
      setExpandedIds(new Set());
      setNodes([]);
      setLinks([]);
      loadGraph(rootId, depth);
    }
  }, [rootId, depth, visibleRelTypes, loadGraph]);

  const handleDoubleClick = useCallback(
    (node: GraphNode) => {
      if (node.id && node.isFrontier && !expandedIds.has(node.id)) {
        loadGraph(node.id, 1, nodes, links);
      }
    },
    [expandedIds, loadGraph, nodes, links]
  );

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

  const toggleRelType = (type: string) => {
    setVisibleRelTypes((prev) => {
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
    (l) => {
      const src = getLinkNodeId(l.source);
      const tgt = getLinkNodeId(l.target);
      return (
        filteredNodeIds.has(src) &&
        filteredNodeIds.has(tgt) &&
        (minStrength === 0 || (l.strength && l.strength >= minStrength))
      );
    }
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || "";
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;
      const color = TYPE_COLORS[node.type] || "#888";
      const radius = 5;

      // Circle
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();

      // Frontier nodes: dashed outline
      if (node.isFrontier) {
        ctx.setLineDash([2 / globalScale, 2 / globalScale]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Label
      if (globalScale > 0.6) {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = color;
        ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 6);
      }

      // Connection count badge
      if ((node.connectionCount ?? 0) > 0 && globalScale > 0.5) {
        const badgeText = String(node.connectionCount);
        const badgeFontSize = 8 / globalScale;
        ctx.font = `bold ${badgeFontSize}px Sans-Serif`;
        const badgeWidth = ctx.measureText(badgeText).width + 4 / globalScale;
        const badgeHeight = badgeFontSize + 2 / globalScale;
        const bx = (node.x ?? 0) + radius + 2 / globalScale;
        const by = (node.y ?? 0) - radius - 2 / globalScale;

        ctx.fillStyle = "#374151";
        ctx.beginPath();
        ctx.roundRect(bx - badgeWidth / 2, by - badgeHeight / 2, badgeWidth, badgeHeight, 2 / globalScale);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, bx, by);
      }
    },
    []
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <h2 className="text-xl font-bold">Relationship Graph</h2>
        <span className="text-sm text-muted-foreground">
          {filteredNodes.length} nodes &middot; {filteredLinks.length} links
        </span>
      </div>

      {/* Root selector + Controls */}
      <div className="p-3 border-b flex flex-wrap items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Root:</span>
          <EntitySearchInput
            value={rootId}
            onChange={(id, label) => {
              setRootId(id);
              setRootLabel(label);
            }}
            placeholder="Pick starting entity..."
            className="w-56"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Depth:</span>
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="text-xs border rounded px-1.5 py-0.5 bg-background"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
        <div className="border-l pl-3 flex flex-wrap items-center gap-2">
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
        </div>
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
        <div className="border-l pl-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                Relation Types
                {visibleRelTypes.size < RELATION_TYPES.length && (
                  <span className="ml-1 text-muted-foreground">({visibleRelTypes.size}/{RELATION_TYPES.length})</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-72 overflow-auto">
              {RELATION_TYPES.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={visibleRelTypes.has(type)}
                  onCheckedChange={() => toggleRelType(type)}
                >
                  {formatLabel(type)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 min-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading graph...</p>
          </div>
        )}
        {!loading && !rootId && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Select an entity above to explore the graph.</p>
          </div>
        )}
        {!loading && rootId && nodes.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No connections found for this entity.</p>
          </div>
        )}
        {graphReady && ForceGraph2D && filteredNodes.length > 0 && (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={{ nodes: filteredNodes, links: filteredLinks }}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(
              node: GraphNode,
              color: string,
              ctx: CanvasRenderingContext2D
            ) => {
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={() => "#88888844"}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node: GraphNode) => {
              if (node.id) navigate(`/entities/${node.id}`);
            }}
            onNodeRightClick={handleDoubleClick}
            cooldownTicks={100}
          />
        )}
      </div>
    </div>
  );
});
