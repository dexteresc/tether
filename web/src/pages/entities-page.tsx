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
import { getEntityConnectionCounts } from "@/lib/supabase-helpers";
import { SensitivityBadge } from "@/components/sensitivity-badge";
import { SensitivityPicker } from "@/components/sensitivity-picker";
import { ENTITY_TYPES, ENTITY_STATUSES } from "@/lib/constants";
import { capitalize, selectClass } from "@/lib/utils";
import { Users, Plus, Brain } from "lucide-react";
import { LocationSearch, type LocationValue } from "@/components/location-search";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Entity = RemoteRow<"entities">;
type Identifier = RemoteRow<"identifiers">;
type EntityRow = ReplicaRow<Entity>;

export const EntitiesPage = observer(function EntitiesPage() {
  const { replica, outbox } = useRootStore();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [identifiersMap, setIdentifiersMap] = useState<
    Record<string, Identifier[]>
  >({});
  const [connectionCounts, setConnectionCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entityType, setEntityType] = useState<string>(ENTITY_TYPES[0]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [sensitivity, setSensitivity] = useState<string>("internal");
  const [location, setLocation] = useState<LocationValue | null>(null);

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

      // Fetch connection counts
      if (activeEntities.length > 0) {
        try {
          const counts = await getEntityConnectionCounts(activeEntities.map((e) => e.id));
          const countMap = new Map<string, number>();
          for (const c of counts) {
            const row = c as { id: string; connections: number };
            countMap.set(row.id, row.connections);
          }
          setConnectionCounts(countMap);
        } catch {
          // Connection counts are optional
        }
      }
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
    setStatus("active");
    setSensitivity("internal");
    setLocation(null);
  }

  function getEntityName(row: EntityRow): string {
    const dataName =
      row.data &&
      typeof row.data === "object" &&
      !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>).name
        : null;
    if (typeof dataName === "string" && dataName) return dataName;
    const ids = identifiersMap[row.id] || [];
    const nameId = ids.find((i) => i.type === "name");
    return nameId?.value ?? "Unnamed";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const data: Record<string, unknown> = { name: name.trim() };
      if (location) {
        data.lat = location.lat;
        data.lng = location.lng;
        data.location_name = location.display_name;
      }
      const entityId = await createRecord("entities", {
        type: entityType,
        status,
        sensitivity,
        data,
      });
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
      render: (row) => (
        <span className="font-medium">{getEntityName(row)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "100px",
      render: (row) => (
        <span className="capitalize text-sm">{row.status}</span>
      ),
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      width: "120px",
      render: (row) => <SensitivityBadge level={row.sensitivity} />,
    },
    {
      key: "connections",
      label: "Connections",
      width: "110px",
      render: (row) => {
        const count = connectionCounts.get(row.id) ?? 0;
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${count > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
            {count}
          </span>
        );
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

  if (!loading && entities.length === 0) {
    return (
      <div>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">Entities</h2>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            Add Entity
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No entities yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Entities are the people, organizations, and things you track. Create one manually or use NL Input to extract them from text.
          </p>
          <div className="flex gap-3">
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Entity
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/nl-input")}>
              <Brain className="h-4 w-4 mr-1" />
              NL Input
            </Button>
          </div>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add Entity</SheetTitle>
              <SheetDescription>Create a new entity (person, organization, etc).</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="entityType">Type</Label>
                <select id="entityType" className={selectClass} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                  {ENTITY_TYPES.map((t) => (<option key={t} value={t}>{capitalize(t)}</option>))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entityStatus">Status</Label>
                <select id="entityStatus" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {ENTITY_STATUSES.map((s) => (<option key={s} value={s}>{capitalize(s)}</option>))}
                </select>
              </div>
              <SensitivityPicker value={sensitivity} onChange={setSensitivity} />
              <div className="flex flex-col gap-2">
                <Label>Location (optional)</Label>
                <LocationSearch value={location} onChange={setLocation} />
              </div>
              <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Creating..." : "Create Entity"}</Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

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
        searchable
        searchPlaceholder="Search by name..."
        searchFn={(row, q) => getEntityName(row).toLowerCase().includes(q)}
        filters={[
          {
            key: "type",
            label: "All Types",
            options: ENTITY_TYPES.map((t) => ({
              value: t,
              label: capitalize(t),
            })),
          },
          {
            key: "status",
            label: "All Statuses",
            options: ENTITY_STATUSES.map((s) => ({
              value: s,
              label: capitalize(s),
            })),
          },
        ]}
        filterFn={(row, filters) => {
          if (filters.type && row.type !== filters.type) return false;
          if (filters.status && row.status !== filters.status) return false;
          return true;
        }}
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
                className={selectClass}
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {capitalize(t)}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="entityStatus">Status</Label>
              <select
                id="entityStatus"
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ENTITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {capitalize(s)}
                  </option>
                ))}
              </select>
            </div>
            <SensitivityPicker value={sensitivity} onChange={setSensitivity} />
            <div className="flex flex-col gap-2">
              <Label>Location (optional)</Label>
              <LocationSearch value={location} onChange={setLocation} />
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
