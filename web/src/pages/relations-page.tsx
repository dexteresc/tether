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
import type { Relation, Entity } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

const RELATION_TYPES = [
  "parent",
  "child",
  "sibling",
  "spouse",
  "relative",
  "colleague",
  "associate",
  "friend",
  "employee",
  "member",
  "owner",
  "founder",
  "co-founder",
  "mentor",
  "client",
  "partner",
  "introduced_by",
  "works_at",
  "lives_in",
  "invested_in",
  "attended",
  "visited",
  "knows",
] as const;

export const RelationsPage = observer(function RelationsPage() {
  const { replica, outbox } = useRootStore();
  const [relations, setRelations] = useState<
    Array<ReplicaRow<Relation>>
  >([]);
  const [entities, setEntities] = useState<Array<ReplicaRow<Entity>>>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState<string>(RELATION_TYPES[0]);
  const [strength, setStrength] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [relationsData, entitiesData] = await Promise.all([
        replica.listByUpdatedAt("relations", 1000),
        replica.listByUpdatedAt("entities", 1000),
      ]);
      setRelations(relationsData.filter((r) => !r.deleted_at));
      setEntities(entitiesData.filter((e) => !e.deleted_at));
    } catch (error) {
      console.error("Failed to load relations:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [replica]);

  // Build entity name lookup
  const entityNameMap = new Map<string, string>();
  for (const e of entities) {
    const data = e.data as Record<string, unknown> | undefined;
    const name = data?.name as string | undefined;
    entityNameMap.set(e.id, name ?? "Unnamed");
  }

  function getEntityLabel(id: string): string {
    return entityNameMap.get(id) ?? id.slice(0, 8) + "...";
  }

  function resetForm() {
    setSourceId("");
    setTargetId("");
    setRelationType(RELATION_TYPES[0]);
    setStrength("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId || !targetId) return;

    setSaving(true);
    try {
      await createRecord("relations", {
        source_id: sourceId,
        target_id: targetId,
        type: relationType,
        strength: strength ? Number(strength) : null,
        data: null,
        valid_from: null,
        valid_to: null,
      });
      await outbox.refresh();
      await load();
      resetForm();
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to create relation:", error);
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const columns: Array<Column<ReplicaRow<Relation>>> = [
    {
      key: "source_id",
      label: "Source",
      width: "160px",
      render: (row) => (
        <span className="font-medium">{getEntityLabel(row.source_id)}</span>
      ),
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
      key: "target_id",
      label: "Target",
      width: "160px",
      render: (row) => (
        <span className="font-medium">{getEntityLabel(row.target_id)}</span>
      ),
    },
    {
      key: "strength",
      label: "Strength",
      width: "100px",
      render: (row) => (
        <span className="font-medium">
          {row.strength !== null ? row.strength : "N/A"}
        </span>
      ),
    },
    {
      key: "valid_from",
      label: "Valid From",
      width: "180px",
      render: (row) =>
        row.valid_from
          ? new Date(row.valid_from).toLocaleDateString()
          : "N/A",
    },
    {
      key: "valid_to",
      label: "Valid To",
      width: "180px",
      render: (row) =>
        row.valid_to
          ? new Date(row.valid_to).toLocaleDateString()
          : "N/A",
    },
  ];

  return (
    <div>
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold">Relations</h2>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          Add Relation
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={relations}
        loading={loading}
        emptyMessage="No relations found."
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Relation</SheetTitle>
            <SheetDescription>
              Create a relationship between two entities.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sourceEntity">Source Entity</Label>
              <select
                id="sourceEntity"
                className={selectClass}
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select source entity...
                </option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {getEntityLabel(e.id)} ({e.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="targetEntity">Target Entity</Label>
              <select
                id="targetEntity"
                className={selectClass}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select target entity...
                </option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {getEntityLabel(e.id)} ({e.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="relationType">Relation Type</Label>
              <select
                id="relationType"
                className={selectClass}
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
              >
                {RELATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="strength">Strength (optional)</Label>
              <Input
                id="strength"
                type="number"
                min="1"
                max="10"
                step="1"
                placeholder="1-10"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={saving || !sourceId || !targetId}
            >
              {saving ? "Creating..." : "Create Relation"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
});
