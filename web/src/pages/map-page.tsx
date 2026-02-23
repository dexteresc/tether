import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useRootStore } from "@/stores/RootStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTypeIcon } from "@/lib/leaflet-setup";
import { getLatLngFromData, formatDistance, DEFAULT_CENTER, DEFAULT_ZOOM, nominatimSearch, type NominatimResult } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { findEntitiesNear, findIntelNear } from "@/lib/supabase-helpers";
import { ENTITY_TYPES } from "@/lib/constants";
import { truncate, TYPE_COLORS } from "@/lib/utils";
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

  // Place search
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState<NominatimResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const skipSearchRef = useRef(false);
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

  const searchPlaces = useCallback(async (q: string) => {
    if (q.length < 2) {
      setPlaceSuggestions([]);
      return;
    }
    setPlaceLoading(true);
    try {
      const data = await nominatimSearch(q, 5);
      setPlaceSuggestions(data);
    } catch {
      setPlaceSuggestions([]);
    } finally {
      setPlaceLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (placeQuery.length >= 2) {
      debounceRef.current = setTimeout(() => searchPlaces(placeQuery), 300);
    } else {
      setPlaceSuggestions([]);
    }
    return () => clearTimeout(debounceRef.current);
  }, [placeQuery, searchPlaces]);

  async function handlePlaceSelect(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setFlyTarget({ lat, lng });
    skipSearchRef.current = true;
    setPlaceQuery(result.display_name);
    setPlaceSuggestions([]);
    setSearching(true);
    try {
      const [nearEntities, nearIntel] = await Promise.all([
        findEntitiesNear(lat, lng, 50000),
        findIntelNear(lat, lng, 50000),
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

          {/* Place search */}
          <div className="space-y-2 relative">
            <h3 className="text-xs font-medium text-muted-foreground">Search Place</h3>
            <Input
              placeholder="Search for a place..."
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
            />
            {placeSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
                {placeSuggestions.map((r) => (
                  <button
                    key={r.place_id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent"
                    onClick={() => handlePlaceSelect(r)}
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
            {placeLoading && placeQuery.length >= 2 && placeSuggestions.length === 0 && (
              <p className="text-xs text-muted-foreground">Searching...</p>
            )}
          </div>

          {/* Search results */}
          {searching && (
            <p className="text-xs text-muted-foreground">Searching nearby...</p>
          )}
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
              <Button size="sm" variant="ghost" className="w-full" onClick={() => { setSearchResults(null); setPlaceQuery(""); setFlyTarget(null); }}>
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
            <FlyToLocation center={flyTarget} />
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
                      <span className="text-xs">{desc ? truncate(desc, 60) : "No description"}</span>
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

function FlyToLocation({ center }: { center: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], 12);
  }, [center, map]);
  return null;
}

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? "#888";
}
