import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useRootStore } from "@/stores/RootStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTypeIcon } from "@/lib/leaflet-setup";
import { getLatLngFromData, formatDistance, DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/geo";
import { findEntitiesNear, findIntelNear } from "@/lib/supabase-helpers";
import { ENTITY_TYPES } from "@/lib/constants";
import { EntityLink } from "@/components/entity-link";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Entity = RemoteRow<"entities">;
type Intel = RemoteRow<"intel">;

function getEntityName(entity: ReplicaRow<Entity>): string {
  const data = entity.data as Record<string, unknown> | null;
  return typeof data?.name === "string" && data.name ? data.name : entity.id.slice(0, 8) + "...";
}

function getIntelDescription(intel: ReplicaRow<Intel>): string {
  const data = intel.data as Record<string, unknown> | null;
  const desc = data?.description;
  return typeof desc === "string" ? desc : "";
}

export const MapPage = observer(function MapPage() {
  const { replica } = useRootStore();
  const navigate = useNavigate();

  const [entities, setEntities] = useState<Array<ReplicaRow<Entity>>>([]);
  const [intel, setIntel] = useState<Array<ReplicaRow<Intel>>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [visibleEntityTypes, setVisibleEntityTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [showIntel, setShowIntel] = useState(true);

  // Proximity search
  const [searchLat, setSearchLat] = useState("");
  const [searchLng, setSearchLng] = useState("");
  const [searchRadius, setSearchRadius] = useState(25);
  const [searchResults, setSearchResults] = useState<{
    entities: Array<{ entity_id: string; entity_type: string; entity_data: unknown; distance_m: number }>;
    intel: Array<{ intel_id: string; intel_type: string; intel_data: unknown; occurred_at: string; distance_m: number }>;
  } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [entitiesData, intelData] = await Promise.all([
          replica.listByUpdatedAt("entities", 10000),
          replica.listByUpdatedAt("intel", 10000),
        ]);
        setEntities(entitiesData.filter((e) => !e.deleted_at));
        setIntel(intelData.filter((i) => !i.deleted_at));
      } catch (error) {
        console.error("Failed to load map data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [replica]);

  // Filter to only geo-tagged items
  const geoEntities = useMemo(
    () => entities.filter((e) => getLatLngFromData(e.data) && visibleEntityTypes.has(e.type)),
    [entities, visibleEntityTypes]
  );
  const geoIntel = useMemo(
    () => (showIntel ? intel.filter((i) => getLatLngFromData(i.data)) : []),
    [intel, showIntel]
  );

  const toggleEntityType = (type: string) => {
    setVisibleEntityTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  async function handleProximitySearch() {
    const lat = parseFloat(searchLat);
    const lng = parseFloat(searchLng);
    if (!isFinite(lat) || !isFinite(lng)) return;
    setSearching(true);
    try {
      const [nearEntities, nearIntel] = await Promise.all([
        findEntitiesNear(lat, lng, searchRadius * 1000),
        findIntelNear(lat, lng, searchRadius * 1000),
      ]);
      setSearchResults({ entities: nearEntities, intel: nearIntel });
    } catch (error) {
      console.error("Proximity search failed:", error);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    import("@/lib/leaflet-setup");
  }, []);

  const markerCount = geoEntities.length + geoIntel.length;

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading map data...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <h2 className="text-xl font-bold">Map</h2>
        <span className="text-sm text-muted-foreground">{markerCount} markers</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Control panel */}
        <div className="w-[280px] border-r flex-shrink-0 overflow-y-auto p-3 space-y-4">
          {/* Entity type filters */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Entity Types</h3>
            <div className="flex flex-wrap gap-1">
              {ENTITY_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleEntityType(type)}
                  className={`px-2 py-0.5 text-xs rounded capitalize transition-opacity ${
                    visibleEntityTypes.has(type) ? "opacity-100" : "opacity-40"
                  }`}
                  style={{ backgroundColor: getTypeColor(type) + "20", color: getTypeColor(type), border: `1px solid ${getTypeColor(type)}` }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Intel toggle */}
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showIntel} onChange={(e) => setShowIntel(e.target.checked)} />
              Show Intel
            </label>
          </div>

          {/* Proximity search */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Proximity Search</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Lat</Label>
                <Input type="number" step="any" placeholder="51.5" value={searchLat} onChange={(e) => setSearchLat(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Lng</Label>
                <Input type="number" step="any" placeholder="-0.12" value={searchLng} onChange={(e) => setSearchLng(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Radius: {searchRadius} km</Label>
              <input type="range" min="1" max="100" value={searchRadius} onChange={(e) => setSearchRadius(Number(e.target.value))} className="w-full" />
            </div>
            <Button size="sm" className="w-full" onClick={handleProximitySearch} disabled={searching || !searchLat || !searchLng}>
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>

          {/* Search results */}
          {searchResults && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                Results: {searchResults.entities.length} entities, {searchResults.intel.length} intel
              </h3>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {searchResults.entities.map((e) => {
                  const d = e.entity_data as Record<string, unknown> | null;
                  const name = typeof d?.name === "string" ? d.name : e.entity_id.slice(0, 8);
                  return (
                    <div key={e.entity_id} className="flex items-center justify-between text-xs p-1 rounded hover:bg-muted">
                      <EntityLink id={e.entity_id} name={name} type={e.entity_type} />
                      <span className="text-muted-foreground">{formatDistance(e.distance_m)}</span>
                    </div>
                  );
                })}
                {searchResults.intel.map((i) => {
                  const d = i.intel_data as Record<string, unknown> | null;
                  const desc = typeof d?.description === "string" ? d.description.slice(0, 30) : i.intel_type;
                  return (
                    <div key={i.intel_id} className="flex items-center justify-between text-xs p-1 rounded hover:bg-muted">
                      <span className="capitalize">{desc}</span>
                      <span className="text-muted-foreground">{formatDistance(i.distance_m)}</span>
                    </div>
                  );
                })}
              </div>
              <Button size="sm" variant="ghost" className="w-full" onClick={() => setSearchResults(null)}>
                Clear results
              </Button>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1">
          <MapContainer
            center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geoEntities.map((entity) => {
              const pos = getLatLngFromData(entity.data)!;
              const name = getEntityName(entity);
              return (
                <Marker
                  key={entity.id}
                  position={[pos.lat, pos.lng]}
                  icon={createTypeIcon(entity.type)}
                  eventHandlers={{ click: () => navigate(`/entities/${entity.id}`) }}
                >
                  <Popup>
                    <div>
                      <span className="font-medium">{name}</span>
                      <br />
                      <span className="text-xs capitalize">{entity.type}</span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {geoIntel.map((item) => {
              const pos = getLatLngFromData(item.data)!;
              const desc = getIntelDescription(item);
              return (
                <Marker
                  key={item.id}
                  position={[pos.lat, pos.lng]}
                  icon={createTypeIcon("intel")}
                >
                  <Popup>
                    <div>
                      <span className="capitalize font-medium">{item.type}</span>
                      <br />
                      <span className="text-xs">{desc.length > 60 ? desc.slice(0, 60) + "..." : desc || "No description"}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">{new Date(item.occurred_at).toLocaleDateString()}</span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
});

const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#8b5cf6",
  group: "#6366f1",
  location: "#10b981",
  event: "#f97316",
  project: "#06b6d4",
  asset: "#ec4899",
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? "#888";
}
