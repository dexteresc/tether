import L from "leaflet";

// Fix default marker icons for Vite bundler
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Color palette matching graph page TYPE_COLORS. */
const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#8b5cf6",
  group: "#6366f1",
  location: "#10b981",
  event: "#f97316",
  project: "#06b6d4",
  asset: "#ec4899",
  intel: "#ef4444",
};

/** Create a colored circle DivIcon for a given entity/intel type. */
export function createTypeIcon(type: string): L.DivIcon {
  const color = TYPE_COLORS[type] ?? "#888";
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
  });
}
