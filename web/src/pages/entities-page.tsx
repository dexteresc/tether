import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useRootStore } from "@/stores/RootStore";
import { DataTable, type Column } from "@/components/data-table";
import type { Entity, Identifier } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

type EntityRow = ReplicaRow<Entity> & { identifiers?: Identifier[] };

export const EntitiesPage = observer(function EntitiesPage() {
  const { replica } = useRootStore();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [identifiersMap, setIdentifiersMap] = useState<
    Record<string, Identifier[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const entitiesData = await replica.listByUpdatedAt(
          "entities",
          1000
        );
        const identifiersData = await replica.listByUpdatedAt(
          "identifiers",
          10000
        );

        const activeEntities = entitiesData.filter(
          (e) => !e.deleted_at
        );
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

    load();
  }, [replica]);

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
      key: "identifiers",
      label: "Identifiers",
      render: (row) => {
        const ids = identifiersMap[row.id] || [];
        if (ids.length === 0)
          return (
            <span className="text-muted-foreground">
              No identifiers
            </span>
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
    {
      key: "updated_at",
      label: "Updated",
      width: "180px",
      render: (row) => new Date(row.updated_at).toLocaleString(),
    },
  ];

  return (
    <div>
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Entities</h2>
      </div>
      <DataTable
        columns={columns}
        data={entities}
        loading={loading}
        onRowClick={(row) => navigate(`/entities/${row.id}`)}
        emptyMessage="No entities found. Create one using Natural Language Input."
      />
    </div>
  );
});
