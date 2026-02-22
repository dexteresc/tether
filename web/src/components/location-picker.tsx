import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { formatLatLng, DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { Button } from "@/components/ui/button";

function ClickHandler({ onClick }: { onClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  height?: string;
}

export function LocationPicker({ value, onChange, height = "200px" }: LocationPickerProps) {
  const setupDone = useRef(false);

  useEffect(() => {
    if (!setupDone.current) {
      import("@/lib/leaflet-setup");
      setupDone.current = true;
    }
  }, []);

  const center = value ?? DEFAULT_CENTER;

  return (
    <div className="space-y-2">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={value ? 12 : DEFAULT_ZOOM}
        style={{ height, width: "100%" }}
        className="rounded-md border"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={onChange} />
        {value && <Marker position={[value.lat, value.lng]} />}
      </MapContainer>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {value ? (
          <>
            <span>{formatLatLng(value)}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Clear
            </Button>
          </>
        ) : (
          <span>Click map to set location</span>
        )}
      </div>
    </div>
  );
}
