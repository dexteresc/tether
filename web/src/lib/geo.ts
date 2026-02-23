import { isRecord } from "./utils";

export interface LatLng {
  lat: number;
  lng: number;
}

export const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
export const DEFAULT_ZOOM = 4;

function isGeoJsonPoint(geom: unknown): geom is { type: "Point"; coordinates: number[] } {
  if (!isRecord(geom)) return false;
  return (
    geom.type === "Point" &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2
  );
}

/** Parse a PostGIS GeoJSON Point into { lat, lng } or undefined. */
export function parseGeom(geom: unknown): LatLng | undefined {
  if (!isGeoJsonPoint(geom)) return undefined;
  return { lat: geom.coordinates[1], lng: geom.coordinates[0] };
}

/** Extract lat/lng from a record's data JSON field. */
export function getLatLngFromData(data: unknown): LatLng | undefined {
  if (!isRecord(data)) return undefined;
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (!isFinite(lat) || !isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
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
export function getLocationName(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  return typeof data.location_name === "string" ? data.location_name : undefined;
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

export async function nominatimReverse(lat: number, lng: number): Promise<string | undefined> {
  await rateLimit();
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { "User-Agent": "Tether/1.0" },
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  return typeof data?.display_name === "string" ? data.display_name : undefined;
}
