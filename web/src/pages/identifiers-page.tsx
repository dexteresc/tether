import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/hooks/use-root-store";
import { DataTable, type Column } from "@/components/data-table";
import { EntityLink } from "@/components/entity-link";
import { useEntityNames } from "@/hooks/use-entity-names";
import { truncate } from "@/lib/utils";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Identifier = RemoteRow<"identifiers">;

export const IdentifiersPage = observer(function IdentifiersPage() {
  const { replica } = useRootStore();
  const entityNames = useEntityNames();
  const [identifiers, setIdentifiers] = useState<
    Array<ReplicaRow<Identifier>>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await replica.listByUpdatedAt("identifiers", 1000);
        setIdentifiers(data);
      } catch (error) {
        console.error("Failed to load identifiers:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [replica]);

  const columns: Array<Column<ReplicaRow<Identifier>>> = [
    {
      key: "entity_id",
      label: "Entity",
      width: "200px",
      render: (row) => {
        const info = entityNames.get(row.entity_id);
        return (
          <EntityLink
            id={row.entity_id}
            name={info?.name ?? truncate(row.entity_id, 8)}
            type={info?.type}
          />
        );
      },
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
      key: "value",
      label: "Value",
      render: (row) => (
        <span className="font-mono text-[13px] font-medium">
          {row.value}
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
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Identifiers</h2>
      </div>
      <DataTable
        columns={columns}
        data={identifiers}
        loading={loading}
        emptyMessage="No identifiers found."
      />
    </div>
  );
});
