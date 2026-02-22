import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import { DataTable, type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { createRecord } from "@/services/sync/createRecord";
import { SensitivityBadge } from "@/components/sensitivity-badge";
import { SensitivityPicker } from "@/components/sensitivity-picker";
import { INTEL_TYPES, CONFIDENCE_LEVELS } from "@/lib/constants";
import { capitalize, truncate, selectClass, CONFIDENCE_COLORS } from "@/lib/utils";
import { LocationPicker } from "@/components/location-picker";
import type { LatLng } from "@/lib/geo";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Intel = RemoteRow<"intel">;

function getDescription(row: ReplicaRow<Intel>): string {
  const desc =
    row.data &&
    typeof row.data === "object" &&
    !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>).description
      : null;
  return typeof desc === "string" ? desc : "";
}

export const IntelPage = observer(function IntelPage() {
  const { replica, outbox } = useRootStore();
  const [intel, setIntel] = useState<Array<ReplicaRow<Intel>>>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [intelType, setIntelType] = useState<string>(INTEL_TYPES[0]);
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [confidence, setConfidence] = useState<string>("medium");
  const [sensitivity, setSensitivity] = useState<string>("internal");
  const [location, setLocation] = useState<LatLng | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await replica.listByUpdatedAt("intel", 1000);
      setIntel(data);
    } catch (error) {
      console.error("Failed to load intel:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [replica]);

  function resetForm() {
    setIntelType(INTEL_TYPES[0]);
    setDescription("");
    setOccurredAt(new Date().toISOString().slice(0, 16));
    setConfidence("medium");
    setSensitivity("internal");
    setLocation(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !occurredAt) return;

    setSaving(true);
    try {
      const intelData: Record<string, unknown> = { description: description.trim() };
      if (location) {
        intelData.lat = location.lat;
        intelData.lng = location.lng;
      }
      await createRecord("intel", {
        type: intelType,
        occurred_at: new Date(occurredAt).toISOString(),
        data: intelData,
        confidence,
        sensitivity,
        source_id: null,
      });
      await outbox.refresh();
      await load();
      resetForm();
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to create intel:", error);
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<Column<ReplicaRow<Intel>>> = [
    {
      key: "occurred_at",
      label: "Occurred",
      width: "180px",
      render: (row) => new Date(row.occurred_at).toLocaleString(),
    },
    {
      key: "type",
      label: "Type",
      width: "140px",
      render: (row) => (
        <span className="capitalize font-medium">{row.type}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (row) => {
        const text = getDescription(row);
        if (text) {
          return (
            <span className="truncate block max-w-md" title={text}>
              {truncate(text, 80)}
            </span>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
    },
    {
      key: "confidence",
      label: "Confidence",
      width: "120px",
      render: (row) => (
          <span
            className={`${CONFIDENCE_COLORS[row.confidence] || ""} font-medium capitalize`}
          >
            {row.confidence}
          </span>
        ),
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      width: "120px",
      render: (row) => <SensitivityBadge level={row.sensitivity} />,
    },
    {
      key: "created_at",
      label: "Created",
      width: "180px",
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ];

  return (
    <div>
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold">Intel</h2>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          Add Intel
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={intel}
        loading={loading}
        emptyMessage="No intel records found."
        searchable
        searchPlaceholder="Search by description..."
        searchFn={(row, q) => getDescription(row).toLowerCase().includes(q)}
        filters={[
          {
            key: "type",
            label: "All Types",
            options: INTEL_TYPES.map((t) => ({
              value: t,
              label: capitalize(t),
            })),
          },
          {
            key: "confidence",
            label: "All Confidence",
            options: CONFIDENCE_LEVELS.map((c) => ({
              value: c,
              label: capitalize(c),
            })),
          },
        ]}
        filterFn={(row, filters) => {
          if (filters.type && row.type !== filters.type) return false;
          if (filters.confidence && row.confidence !== filters.confidence) return false;
          return true;
        }}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Intel</SheetTitle>
            <SheetDescription>
              Create a new intelligence record.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="intelType">Type</Label>
              <select
                id="intelType"
                className={selectClass}
                value={intelType}
                onChange={(e) => setIntelType(e.target.value)}
              >
                {INTEL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {capitalize(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder="Describe the intelligence..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="occurredAt">Occurred At</Label>
              <Input
                id="occurredAt"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confidence">Confidence</Label>
              <select
                id="confidence"
                className={selectClass}
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
              >
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {capitalize(c)}
                  </option>
                ))}
              </select>
            </div>
            <SensitivityPicker value={sensitivity} onChange={setSensitivity} />
            <div className="flex flex-col gap-2">
              <Label>Location (optional)</Label>
              <LocationPicker value={location} onChange={setLocation} />
            </div>
            <Button
              type="submit"
              disabled={saving || !description.trim() || !occurredAt}
            >
              {saving ? "Creating..." : "Create Intel"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
});
