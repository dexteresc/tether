import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { getEntityGraphV2 } from "@/lib/supabase-helpers";
import { TYPE_COLORS } from "@/lib/utils";

let ForceGraph2D: React.ComponentType<Record<string, unknown>> | undefined =
  undefined;

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
}

interface MiniGraphProps {
  entityId: string;
  height?: number;
}

export function MiniGraph({ entityId, height = 250 }: MiniGraphProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [graphReady, setGraphReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(400);

  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      ForceGraph2D = mod.default;
      setGraphReady(true);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEntityGraphV2(entityId, 1)
      .then((data) => {
        if (cancelled || !data || data.length === 0) {
          setNodes([]);
          setLinks([]);
          setLoading(false);
          return;
        }

        const nodeMap = new Map<string, GraphNode>();
        const linkSet = new Set<string>();
        const newLinks: GraphLink[] = [];

        for (const row of data) {
          const entityData =
            typeof row.entity_data === "object" &&
            row.entity_data !== null &&
            !Array.isArray(row.entity_data)
              ? row.entity_data
              : undefined;

          if (!nodeMap.has(row.entity_id)) {
            const name =
              entityData && typeof entityData.name === "string"
                ? entityData.name
                : undefined;
            nodeMap.set(row.entity_id, {
              id: row.entity_id,
              label: name ?? row.entity_id.slice(0, 8),
              type: row.entity_type,
              val: 1,
            });
          }

          if (
            row.relation_source_id &&
            row.relation_target_id &&
            row.relation_type
          ) {
            const linkKey = `${row.relation_source_id}-${row.relation_target_id}-${row.relation_type}`;
            const linkKeyReverse = `${row.relation_target_id}-${row.relation_source_id}-${row.relation_type}`;
            if (!linkSet.has(linkKey) && !linkSet.has(linkKeyReverse)) {
              linkSet.add(linkKey);
              newLinks.push({
                source: row.relation_source_id,
                target: row.relation_target_id,
                label: row.relation_type,
              });
            }
          }
        }

        setNodes(Array.from(nodeMap.values()));
        setLinks(newLinks);
        setLoading(false);
      })
      .catch(() => {
        setNodes([]);
        setLinks([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || "";
      const fontSize = 10 / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;
      const color = TYPE_COLORS[node.type] || "#888";
      const radius = node.id === entityId ? 6 : 4;

      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();

      if (globalScale > 0.5) {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = color;
        ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + radius + 2);
      }
    },
    [entityId]
  );

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center rounded-md border bg-muted/30"
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">Loading graph...</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center rounded-md border bg-muted/30"
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">No connections</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-md border overflow-hidden"
      style={{ height }}
    >
      {graphReady && ForceGraph2D && (
        <ForceGraph2D
          width={width}
          height={height}
          graphData={{ nodes, links }}
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
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          onNodeClick={(node: GraphNode) => {
            if (node.id) navigate(`/entities/${node.id}`);
          }}
          cooldownTicks={60}
        />
      )}
    </div>
  );
}
