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
import type { Intel } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

const INTEL_TYPES = [
  "event",
  "communication",
  "sighting",
  "report",
  "document",
  "media",
  "financial",
] as const;

const CONFIDENCE_LEVELS = [
  "confirmed",
  "high",
  "medium",
  "low",
  "unconfirmed",
] as const;

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
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !occurredAt) return;

    setSaving(true);
    try {
      await createRecord("intel", {
        type: intelType,
        occurred_at: new Date(occurredAt).toISOString(),
        data: { description: description.trim() },
        confidence,
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
        const desc =
          row.data &&
          typeof row.data === "object" &&
          !Array.isArray(row.data)
            ? (row.data as Record<string, unknown>).description
            : null;
        if (desc) {
          const text = String(desc);
          return (
            <span className="truncate block max-w-md" title={text}>
              {text.length > 80 ? text.slice(0, 80) + "..." : text}
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
      render: (row) => {
        const colors: Record<string, string> = {
          confirmed: "text-emerald-600",
          high: "text-emerald-500",
          medium: "text-amber-500",
          low: "text-orange-500",
          unconfirmed: "text-muted-foreground",
        };
        return (
          <span
            className={`${colors[row.confidence] || ""} font-medium capitalize`}
          >
            {row.confidence}
          </span>
        );
      },
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={intelType}
                onChange={(e) => setIntelType(e.target.value)}
              >
                {INTEL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
              >
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
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
