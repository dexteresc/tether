import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useRootStore } from "@/hooks/use-root-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EntityLink } from "@/components/entity-link";
import { truncate, isRecord } from "@/lib/utils";
import { Plus, Brain, MessageSquare, Search, CheckCircle2, Circle } from "lucide-react";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Entity = RemoteRow<"entities">;
type Intel = RemoteRow<"intel">;

const typeColors: Record<string, string> = {
  person: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  organization: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  group: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  location: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  event: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  project: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  asset: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  intel: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function TypeBadge({ type }: { type: string }) {
  const cls = typeColors[type] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {type}
    </span>
  );
}

function getEntityName(entity: ReplicaRow<Entity>, idMap: Map<string, string>): string {
  const data = isRecord(entity.data) ? entity.data : undefined;
  const dataName = data?.name;
  if (typeof dataName === "string" && dataName) return dataName;
  return idMap.get(entity.id) ?? entity.id.slice(0, 8) + "...";
}

function getIntelDescription(intel: ReplicaRow<Intel>): string {
  const data = isRecord(intel.data) ? intel.data : undefined;
  const desc = data?.description;
  if (typeof desc === "string") return truncate(desc, 100);
  return "-";
}

interface ActivityItem {
  id: string;
  date: string;
  type: "entity" | "intel";
  badge: string;
  title: string;
  entityId?: string;
}

const Dashboard = observer(function Dashboard() {
  const { replica } = useRootStore();
  const navigate = useNavigate();

  const [entityCount, setEntityCount] = useState(0);
  const [intelCount, setIntelCount] = useState(0);
  const [relationCount, setRelationCount] = useState(0);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [incompleteEntities, setIncompleteEntities] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [orphanedIntel, setOrphanedIntel] = useState<Array<{ id: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [entities, intel, relations, identifiers, attributes, intelEntities] = await Promise.all([
          replica.listByUpdatedAt("entities", 10000),
          replica.listByUpdatedAt("intel", 10000),
          replica.listByUpdatedAt("relations", 10000),
          replica.listByUpdatedAt("identifiers", 50000),
          replica.listByUpdatedAt("entity_attributes", 10000),
          replica.listByUpdatedAt("intel_entities", 10000),
        ]);

        const activeEntities = entities.filter((e) => !e.deleted_at);
        const activeIntel = intel.filter((i) => !i.deleted_at);
        const activeRelations = relations.filter((r) => !r.deleted_at);
        const activeAttributes = attributes.filter((a) => !a.deleted_at);
        const activeIntelEntities = intelEntities.filter((ie) => !ie.deleted_at);

        setEntityCount(activeEntities.length);
        setIntelCount(activeIntel.length);
        setRelationCount(activeRelations.length);

        // Name map from identifiers
        const idMap = new Map<string, string>();
        for (const id of identifiers) {
          if (id.type === "name" && !idMap.has(id.entity_id)) {
            idMap.set(id.entity_id, id.value);
          }
        }
        // Activity feed: merge recent entities + intel, sorted by date
        const feed: ActivityItem[] = [];
        for (const e of activeEntities.slice(0, 15)) {
          feed.push({
            id: `entity-${e.id}`,
            date: e.created_at,
            type: "entity",
            badge: e.type,
            title: getEntityName(e, idMap),
            entityId: e.id,
          });
        }
        for (const i of activeIntel.slice(0, 15)) {
          feed.push({
            id: `intel-${i.id}`,
            date: i.created_at,
            type: "intel",
            badge: i.type,
            title: getIntelDescription(i),
          });
        }
        feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setActivityFeed(feed.slice(0, 15));

        // Suggestions: incomplete entities (< 2 relations AND < 3 attributes)
        const relCountMap = new Map<string, number>();
        for (const r of activeRelations) {
          relCountMap.set(r.source_id, (relCountMap.get(r.source_id) ?? 0) + 1);
          relCountMap.set(r.target_id, (relCountMap.get(r.target_id) ?? 0) + 1);
        }
        const attrCountMap = new Map<string, number>();
        for (const a of activeAttributes) {
          attrCountMap.set(a.entity_id, (attrCountMap.get(a.entity_id) ?? 0) + 1);
        }
        const incomplete = activeEntities
          .filter((e) => (relCountMap.get(e.id) ?? 0) < 2 && (attrCountMap.get(e.id) ?? 0) < 3)
          .slice(0, 5)
          .map((e) => ({ id: e.id, name: getEntityName(e, idMap), type: e.type }));
        setIncompleteEntities(incomplete);

        // Suggestions: orphaned intel (not linked to any entity)
        const linkedIntelIds = new Set(activeIntelEntities.map((ie) => ie.intel_id));
        const orphaned = activeIntel
          .filter((i) => !linkedIntelIds.has(i.id))
          .slice(0, 5)
          .map((i) => ({ id: i.id, description: getIntelDescription(i) }));
        setOrphanedIntel(orphaned);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [replica]);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading dashboard...</div>;
  }

  // Onboarding state
  if (entityCount === 0) {
    const steps = [
      { label: "Create your first entity", done: false, action: () => navigate("/entities") },
      { label: "Add intelligence via NL Input", done: false, action: () => navigate("/nl-input") },
      { label: "Ask a question about your network", done: false, action: () => navigate("/ask") },
      { label: "Explore the relationship graph", done: false, action: () => navigate("/graph") },
    ];

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                    <span className="text-sm">{step.label}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={step.action}>
                    Go
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Dashboard</h2>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => navigate("/entities")}>
          <Plus className="h-4 w-4 mr-1" />
          Create Entity
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/nl-input")}>
          <Brain className="h-4 w-4 mr-1" />
          NL Input
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/ask")}>
          <MessageSquare className="h-4 w-4 mr-1" />
          Ask
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">Cmd+K</kbd> to search
        </span>
      </div>

      {/* Network summary */}
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{entityCount}</span> entities
        {" · "}
        <span className="font-medium text-foreground">{relationCount}</span> relations
        {" · "}
        <span className="font-medium text-foreground">{intelCount}</span> intel
      </p>

      {/* 2/3 + 1/3 grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activityFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    <TypeBadge type={item.badge} />
                    <div className="flex-1 min-w-0">
                      {item.entityId ? (
                        <EntityLink id={item.entityId} name={item.title} type={item.badge} />
                      ) : (
                        <span className="text-sm truncate block">{item.title}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {incompleteEntities.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Incomplete Entities</p>
                <div className="space-y-1.5">
                  {incompleteEntities.map((e) => (
                    <Link
                      key={e.id}
                      to={`/entities/${e.id}`}
                      className="flex items-center gap-2 text-sm hover:underline text-primary"
                    >
                      <Search className="h-3 w-3" />
                      <span className="truncate">{e.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">({e.type})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {orphanedIntel.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Orphaned Intel</p>
                <div className="space-y-1.5">
                  {orphanedIntel.map((i) => (
                    <Link
                      key={i.id}
                      to="/intel"
                      className="flex items-center gap-2 text-sm hover:underline text-primary"
                    >
                      <Search className="h-3 w-3" />
                      <span className="truncate">{truncate(i.description, 40)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {incompleteEntities.length === 0 && orphanedIntel.length === 0 && (
              <p className="text-sm text-muted-foreground">No suggestions right now.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default Dashboard;
