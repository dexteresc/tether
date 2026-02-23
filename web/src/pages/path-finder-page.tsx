import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { EntitySearchInput } from "@/components/entity-search-input";
import {
  findShortestPath,
  searchEntitiesByIdentifier,
} from "@/lib/supabase-helpers";
import { TYPE_COLORS } from "@/lib/utils";

interface PathStep {
  entity_id: string;
  name: string;
  type: string;
}

interface PathResult {
  steps: PathStep[];
  relationTypes: string[];
}

let ForceGraph2D: React.ComponentType<Record<string, unknown>> | undefined =
  undefined;

interface PathGraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
}

export function PathFinderPage() {
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const [targetId, setTargetId] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<PathResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [graphReady, setGraphReady] = useState(false);

  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      ForceGraph2D = mod.default;
      setGraphReady(true);
    });
  }, []);

  const resolveEntityName = useCallback(
    async (entityId: string): Promise<{ name: string; type: string }> => {
      try {
        const results = await searchEntitiesByIdentifier("%");
        const match = (results ?? []).find((r) => r.entity_id === entityId);
        if (match)
          return { name: match.identifier_value, type: match.entity_type };
      } catch {
        // fallback
      }
      return { name: entityId.slice(0, 8), type: "unknown" };
    },
    []
  );

  async function handleFindPath() {
    if (!sourceId || !targetId) return;
    setLoading(true);
    setError(undefined);
    setResult(undefined);
    try {
      const data = await findShortestPath(sourceId, targetId, 6);
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setError("No path found between these entities.");
        return;
      }

      // data is an array with a single row containing path and relation_types
      const row = Array.isArray(data) ? data[0] : data;
      const pathIds: string[] = row.path ?? [];
      const relTypes: string[] = row.relation_types ?? [];

      if (pathIds.length === 0) {
        setError("No path found between these entities.");
        return;
      }

      // Resolve names for each entity in the path
      const steps: PathStep[] = await Promise.all(
        pathIds.map(async (id) => {
          const info = await resolveEntityName(id);
          return { entity_id: id, name: info.name, type: info.type };
        })
      );

      setResult({ steps, relationTypes: relTypes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find path");
    } finally {
      setLoading(false);
    }
  }

  // Build graph data for mini visualization
  const graphData = result
    ? {
        nodes: result.steps.map((s) => ({
          id: s.entity_id,
          label: s.name,
          type: s.type,
        })),
        links: result.steps.slice(0, -1).map((s, i) => ({
          source: s.entity_id,
          target: result.steps[i + 1].entity_id,
          label: result.relationTypes[i] ?? "",
        })),
      }
    : undefined;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-1">Path Finder</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Find how two entities are connected through relationships.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Source</label>
          <EntitySearchInput
            value={sourceId}
            onChange={(id) => {
              setSourceId(id);
            }}
            placeholder="Search source entity..."
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Target</label>
          <EntitySearchInput
            value={targetId}
            onChange={(id) => {
              setTargetId(id);
            }}
            placeholder="Search target entity..."
          />
        </div>
      </div>

      <Button
        onClick={handleFindPath}
        disabled={!sourceId || !targetId || loading}
        className="mb-6"
      >
        {loading ? "Finding path..." : "Find Path"}
      </Button>

      {error && (
        <div className="text-sm text-destructive mb-4">{error}</div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Chain visualization */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Connection Path</h3>
            <div className="flex flex-wrap items-center gap-2">
              {result.steps.map((step, i) => (
                <div key={step.entity_id} className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/entities/${step.entity_id}`)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor:
                        (TYPE_COLORS[step.type] ?? "#888") + "20",
                      color: TYPE_COLORS[step.type] ?? "#888",
                      border: `1px solid ${TYPE_COLORS[step.type] ?? "#888"}`,
                    }}
                  >
                    {step.name}
                  </button>
                  {i < result.steps.length - 1 && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      —{result.relationTypes[i] ?? "?"}→
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mini force graph */}
          {graphReady && ForceGraph2D && graphData && (
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Graph View</h3>
              <div className="h-[300px]">
                <ForceGraph2D
                  width={600}
                  height={280}
                  graphData={graphData}
                  nodeCanvasObject={(
                    node: PathGraphNode,
                    ctx: CanvasRenderingContext2D,
                    globalScale: number
                  ) => {
                    const label = node.label || "";
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const color = TYPE_COLORS[node.type] || "#888";
                    ctx.beginPath();
                    ctx.arc(
                      node.x ?? 0,
                      node.y ?? 0,
                      6,
                      0,
                      2 * Math.PI,
                      false
                    );
                    ctx.fillStyle = color;
                    ctx.fill();
                    if (globalScale > 0.4) {
                      ctx.textAlign = "center";
                      ctx.textBaseline = "top";
                      ctx.fillStyle = color;
                      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 8);
                    }
                  }}
                  linkColor={() => "#88888866"}
                  linkDirectionalArrowLength={4}
                  linkDirectionalArrowRelPos={1}
                  onNodeClick={(node: PathGraphNode) => {
                    if (node.id) navigate(`/entities/${node.id}`);
                  }}
                  cooldownTicks={60}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
