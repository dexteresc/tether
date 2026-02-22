import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import { DataTable, type Column } from "@/components/data-table";
import { EntityLink } from "@/components/entity-link";
import { useEntityNames } from "@/hooks/use-entity-names";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type IntelEntity = RemoteRow<"intel_entities">;
type Intel = RemoteRow<"intel">;

export const IntelEntitiesPage = observer(
  function IntelEntitiesPage() {
    const { replica } = useRootStore();
    const entityNames = useEntityNames();
    const [intelEntities, setIntelEntities] = useState<
      Array<ReplicaRow<IntelEntity>>
    >([]);
    const [intelMap, setIntelMap] = useState<Map<string, ReplicaRow<Intel>>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      async function load() {
        setLoading(true);
        try {
          const [data, intelData] = await Promise.all([
            replica.listByUpdatedAt("intel_entities", 1000),
            replica.listByUpdatedAt("intel", 10000),
          ]);
          setIntelEntities(data);
          const map = new Map<string, ReplicaRow<Intel>>();
          for (const i of intelData) {
            if (!i.deleted_at) map.set(i.id, i);
          }
          setIntelMap(map);
        } catch (error) {
          console.error("Failed to load intel entities:", error);
        } finally {
          setLoading(false);
        }
      }
      load();
    }, [replica]);

    function getIntelLabel(intelId: string): string {
      const intel = intelMap.get(intelId);
      if (!intel) return intelId.slice(0, 8) + "...";
      const data = intel.data as Record<string, unknown> | null;
      const desc = typeof data?.description === "string" ? data.description : null;
      if (desc) return desc.length > 40 ? desc.slice(0, 40) + "..." : desc;
      return `${intel.type} (${new Date(intel.occurred_at).toLocaleDateString()})`;
    }

    const columns: Array<Column<ReplicaRow<IntelEntity>>> = [
      {
        key: "intel_id",
        label: "Intel",
        width: "260px",
        render: (row) => (
          <span className="text-sm">{getIntelLabel(row.intel_id)}</span>
        ),
      },
      {
        key: "entity_id",
        label: "Entity",
        width: "200px",
        render: (row) => {
          const info = entityNames.get(row.entity_id);
          return (
            <EntityLink
              id={row.entity_id}
              name={info?.name ?? row.entity_id.slice(0, 8) + "..."}
              type={info?.type}
            />
          );
        },
      },
      {
        key: "role",
        label: "Role",
        render: (row) => (
          <span className="capitalize">{row.role || "N/A"}</span>
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
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">
            Intel-Entity Relationships
          </h2>
        </div>
        <DataTable
          columns={columns}
          data={intelEntities}
          loading={loading}
          emptyMessage="No intel-entity relationships found."
        />
      </div>
    );
  }
);
