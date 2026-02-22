import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useRootStore } from "@/stores/RootStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ENTITY_TYPES } from "@/lib/constants";
import { EntityLink } from "@/components/entity-link";
import { MiniMap, type MapMarker } from "@/components/mini-map";
import { getLatLngFromData, DEFAULT_CENTER } from "@/lib/geo";
import { truncate } from "@/lib/utils";
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
  const data = entity.data as Record<string, unknown> | null;
  const dataName = data?.name;
  if (typeof dataName === "string" && dataName) return dataName;
  return idMap.get(entity.id) ?? entity.id.slice(0, 8) + "...";
}

function getIntelDescription(intel: ReplicaRow<Intel>): string {
  const data = intel.data as Record<string, unknown> | null;
  const desc = data?.description;
  if (typeof desc === "string") {
    return truncate(desc, 100);
  }
  return "-";
}

const Dashboard = observer(function Dashboard() {
  const { replica, syncStatus, nlQueue } = useRootStore();
  const navigate = useNavigate();

  const [entityCount, setEntityCount] = useState(0);
  const [intelCount, setIntelCount] = useState(0);
  const [relationCount, setRelationCount] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [recentIntel, setRecentIntel] = useState<Array<ReplicaRow<Intel>>>([]);
  const [recentEntities, setRecentEntities] = useState<Array<ReplicaRow<Entity>>>([]);
  const [entityNameMap, setEntityNameMap] = useState<Map<string, string>>(new Map());
  const [geoMarkers, setGeoMarkers] = useState<MapMarker[]>([]);
  const [nlText, setNlText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [entities, intel, relations, identifiers] = await Promise.all([
          replica.listByUpdatedAt("entities", 10000),
          replica.listByUpdatedAt("intel", 10000),
          replica.listByUpdatedAt("relations", 10000),
          replica.listByUpdatedAt("identifiers", 50000),
        ]);

        const activeEntities = entities.filter((e) => !e.deleted_at);
        const activeIntel = intel.filter((i) => !i.deleted_at);
        const activeRelations = relations.filter((r) => !r.deleted_at);

        setEntityCount(activeEntities.length);
        setIntelCount(activeIntel.length);
        setRelationCount(activeRelations.length);

        // Type counts
        const counts: Record<string, number> = {};
        for (const e of activeEntities) {
          counts[e.type] = (counts[e.type] || 0) + 1;
        }
        setTypeCounts(counts);

        // Name map from identifiers
        const idMap = new Map<string, string>();
        for (const id of identifiers) {
          if (id.type === "name" && !idMap.has(id.entity_id)) {
            idMap.set(id.entity_id, id.value);
          }
        }
        setEntityNameMap(idMap);

        // Geo markers for map widget
        const markers: MapMarker[] = [];
        for (const e of activeEntities) {
          const pos = getLatLngFromData(e.data);
          if (pos) {
            markers.push({
              id: e.id,
              position: pos,
              label: getEntityName(e, idMap),
              type: e.type,
            });
          }
        }
        setGeoMarkers(markers);

        setRecentIntel(activeIntel.slice(0, 5));
        setRecentEntities(activeEntities.slice(0, 5));
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [replica]);

  async function handleNlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nlText.trim()) return;
    await nlQueue.enqueue(nlText.trim());
    setNlText("");
    navigate("/nl-input");
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Dashboard</h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entityCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Intel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{intelCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Relations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{relationCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStatus.pendingOutboxCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Entity breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Entity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ENTITY_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <TypeBadge type={type} />
                <span className="text-sm font-medium">{typeCounts[type] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Location Overview */}
      {geoMarkers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Location Overview ({geoMarkers.length} entities)</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniMap
              center={geoMarkers[0]?.position ?? DEFAULT_CENTER}
              zoom={4}
              height="250px"
              markers={geoMarkers}
              onMarkerClick={(id) => navigate(`/entities/${id}`)}
              interactive
            />
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Latest Intel</CardTitle>
          </CardHeader>
          <CardContent>
            {recentIntel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No intel yet.</p>
            ) : (
              <div className="space-y-3">
                {recentIntel.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <TypeBadge type={item.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{getIntelDescription(item)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.occurred_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Newest Entities</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEntities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entities yet.</p>
            ) : (
              <div className="space-y-3">
                {recentEntities.map((entity) => (
                  <div key={entity.id} className="flex items-center gap-2">
                    <TypeBadge type={entity.type} />
                    <EntityLink
                      id={entity.id}
                      name={getEntityName(entity, entityNameMap)}
                      type={entity.type}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick NL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Intelligence Input</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNlSubmit} className="flex gap-2">
            <textarea
              className="flex min-h-[60px] flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder="Enter intelligence text for NLP extraction..."
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
            />
            <Button type="submit" disabled={!nlText.trim()}>
              Submit
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
});

export default Dashboard;
