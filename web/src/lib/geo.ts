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
