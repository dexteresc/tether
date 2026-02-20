import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import { DataTable, type Column } from "@/components/data-table";
import type { Identifier } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

export const IdentifiersPage = observer(function IdentifiersPage() {
  const { replica } = useRootStore();
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
      width: "160px",
      render: (row) => (
        <span className="font-mono text-xs">
          {row.entity_id.slice(0, 8)}...
        </span>
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
