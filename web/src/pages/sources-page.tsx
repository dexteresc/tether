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
import type { Source } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

const RELIABILITY_OPTIONS = [
  { value: "A", label: "A - Completely reliable" },
  { value: "B", label: "B - Usually reliable" },
  { value: "C", label: "C - Fairly reliable" },
  { value: "D", label: "D - Not usually reliable" },
  { value: "E", label: "E - Unreliable" },
  { value: "F", label: "F - Cannot be judged" },
] as const;

const SOURCE_TYPES = ["humint", "sigint", "osint", "document", "media", "other"] as const;

export const SourcesPage = observer(function SourcesPage() {
  const { replica, outbox } = useRootStore();
  const [sources, setSources] = useState<Array<ReplicaRow<Source>>>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [type, setType] = useState<string>(SOURCE_TYPES[0]);
  const [reliability, setReliability] = useState<string>("B");

  async function load() {
    setLoading(true);
    try {
      const data = await replica.listByUpdatedAt("sources", 1000);
      setSources(data);
    } catch (error) {
      console.error("Failed to load sources:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [replica]);

  function resetForm() {
    setCode("");
    setType(SOURCE_TYPES[0]);
    setReliability("B");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setSaving(true);
    try {
      await createRecord("sources", {
        code: code.trim(),
        type,
        reliability,
        active: true,
        data: {},
      });
      await outbox.refresh();
      await load();
      resetForm();
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to create source:", error);
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<Column<ReplicaRow<Source>>> = [
    {
      key: "code",
      label: "Code",
      width: "120px",
      render: (row) => (
        <span className="font-mono font-semibold">{row.code}</span>
      ),
    },
    {
      key: "type",
      label: "Type",
      width: "140px",
      render: (row) => <span className="capitalize">{row.type}</span>,
    },
    {
      key: "reliability",
      label: "Reliability",
      width: "120px",
      render: (row) => {
        const colors: Record<string, string> = {
          A: "text-emerald-600",
          B: "text-emerald-500",
          C: "text-lime-500",
          D: "text-amber-500",
          E: "text-orange-500",
          F: "text-red-600",
        };
        return (
          <span
            className={`${colors[row.reliability] || ""} font-semibold text-base`}
          >
            {row.reliability}
          </span>
        );
      },
    },
    {
      key: "active",
      label: "Active",
      width: "100px",
      render: (row) => (
        <span
          className={
            row.active
              ? "text-emerald-600"
              : "text-muted-foreground"
          }
        >
          {row.active ? "Yes" : "No"}
        </span>
      ),
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
        <h2 className="text-xl font-bold">Sources</h2>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          Add Source
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={sources}
        loading={loading}
        emptyMessage="No sources found."
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Source</SheetTitle>
            <SheetDescription>
              Create a new intelligence source.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="e.g. SRC-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reliability">Reliability</Label>
              <select
                id="reliability"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={reliability}
                onChange={(e) => setReliability(e.target.value)}
              >
                {RELIABILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={saving || !code.trim()}>
              {saving ? "Creating..." : "Create Source"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
});
