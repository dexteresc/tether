import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { DEFAULT_ZOOM } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { createTypeIcon } from "@/lib/leaflet-setup";

export interface MapMarker {
  id: string;
  position: LatLng;
  label: string;
  type: string;
}

interface MiniMapProps {
  center: LatLng;
  zoom?: number;
  height?: string;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  interactive?: boolean;
}

export function MiniMap({
  center,
  zoom = DEFAULT_ZOOM,
  height = "250px",
  markers = [],
  onMarkerClick,
  interactive = false,
}: MiniMapProps) {
  const setupDone = useRef(false);

  useEffect(() => {
    if (!setupDone.current) {
      import("@/lib/leaflet-setup");
      setupDone.current = true;
    }
  }, []);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height, width: "100%" }}
      className="rounded-md border"
      dragging={interactive}
      zoomControl={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.position.lat, marker.position.lng]}
          icon={createTypeIcon(marker.type)}
          eventHandlers={
            onMarkerClick
              ? { click: () => onMarkerClick(marker.id) }
              : undefined
          }
        >
          <Popup>
            <span className="text-sm font-medium">{marker.label}</span>
            <br />
            <span className="text-xs capitalize text-muted-foreground">{marker.type}</span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
