import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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
import type { Entity, Identifier } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

type EntityRow = ReplicaRow<Entity> & { identifiers?: Identifier[] };

const ENTITY_TYPES = [
  "person",
  "organization",
  "group",
  "vehicle",
  "location",
] as const;

export const EntitiesPage = observer(function EntitiesPage() {
  const { replica, outbox } = useRootStore();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [identifiersMap, setIdentifiersMap] = useState<
    Record<string, Identifier[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entityType, setEntityType] = useState<string>(ENTITY_TYPES[0]);
  const [name, setName] = useState("");

  async function load() {
    setLoading(true);
    try {
      const entitiesData = await replica.listByUpdatedAt("entities", 1000);
      const identifiersData = await replica.listByUpdatedAt(
        "identifiers",
        10000
      );

      const activeEntities = entitiesData.filter((e) => !e.deleted_at);
      const activeIdentifiers = identifiersData.filter(
        (i) => !i.deleted_at
      );

      const idMap: Record<string, Identifier[]> = {};
      for (const id of activeIdentifiers) {
        if (!idMap[id.entity_id]) {
          idMap[id.entity_id] = [];
        }
        idMap[id.entity_id].push(id);
      }

      setIdentifiersMap(idMap);
      setEntities(activeEntities);
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [replica]);

  function resetForm() {
    setEntityType(ENTITY_TYPES[0]);
    setName("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const entityId = await createRecord("entities", {
        type: entityType,
        data: { name: name.trim() },
      });
      // Also create a "name" identifier for the entity
      await createRecord("identifiers", {
        entity_id: entityId,
        type: "name",
        value: name.trim(),
        metadata: {},
      });
      await outbox.refresh();
      await load();
      resetForm();
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to create entity:", error);
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<Column<EntityRow>> = [
    {
      key: "type",
      label: "Type",
      width: "120px",
      render: (row) => (
        <span className="capitalize font-medium">{row.type}</span>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => {
        const dataName =
          row.data &&
          typeof row.data === "object" &&
          !Array.isArray(row.data)
            ? (row.data as Record<string, unknown>).name
            : null;
        if (dataName) {
          return <span className="font-medium">{String(dataName)}</span>;
        }
        const ids = identifiersMap[row.id] || [];
        const nameId = ids.find((i) => i.type === "name");
        if (nameId) return <span className="font-medium">{nameId.value}</span>;
        return <span className="text-muted-foreground">Unnamed</span>;
      },
    },
    {
      key: "identifiers",
      label: "Identifiers",
      render: (row) => {
        const ids = identifiersMap[row.id] || [];
        if (ids.length === 0)
          return (
            <span className="text-muted-foreground">No identifiers</span>
          );
        return (
          <div className="flex flex-wrap gap-1">
            {ids.slice(0, 3).map((id) => (
              <span
                key={id.id}
                className="px-2 py-0.5 bg-muted rounded text-xs font-mono"
              >
                {id.type}: {id.value}
              </span>
            ))}
            {ids.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{ids.length - 3} more
              </span>
            )}
          </div>
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
        <h2 className="text-xl font-bold">Entities</h2>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          Add Entity
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={entities}
        loading={loading}
        onRowClick={(row) => navigate(`/entities/${row.id}`)}
        emptyMessage="No entities found."
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Entity</SheetTitle>
            <SheetDescription>
              Create a new entity (person, organization, etc).
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="entityType">Type</Label>
              <select
                id="entityType"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating..." : "Create Entity"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
});
