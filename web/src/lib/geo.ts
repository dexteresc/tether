export interface LatLng {
  lat: number;
  lng: number;
}

export const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
export const DEFAULT_ZOOM = 4;

/** Parse a PostGIS GeoJSON Point into { lat, lng } or null. */
export function parseGeom(geom: unknown): LatLng | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: number[] };
  if (g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    return { lat: g.coordinates[1], lng: g.coordinates[0] };
  }
  return null;
}

/** Extract lat/lng from a record's data JSON field. */
export function getLatLngFromData(data: unknown): LatLng | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const lat = Number(d.lat);
  const lng = Number(d.lng);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Format a LatLng as "51.5074, -0.1278". */
export function formatLatLng(pos: LatLng): string {
  return `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
}

/** Format distance in meters as "2.3 km" or "450 m". */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/** Extract location_name from a record's data JSON field. */
export function getLocationName(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  return typeof d.location_name === "string" ? d.location_name : null;
}

// --- Nominatim Geocoding ---

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

let lastNominatimCall = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < 1000) {
    await new Promise((r) => setTimeout(r, 1000 - elapsed));
  }
  lastNominatimCall = Date.now();
}

export async function nominatimSearch(query: string, limit = 5): Promise<NominatimResult[]> {
  await rateLimit();
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: String(limit),
    addressdetails: "0",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "Tether/1.0" },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function nominatimReverse(lat: number, lng: number): Promise<string | null> {
  await rateLimit();
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { "User-Agent": "Tether/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.display_name === "string" ? data.display_name : null;
}
