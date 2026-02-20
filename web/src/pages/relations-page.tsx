import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import { DataTable, type Column } from "@/components/data-table";
import type { Relation } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

export const RelationsPage = observer(function RelationsPage() {
  const { replica } = useRootStore();
  const [relations, setRelations] = useState<
    Array<ReplicaRow<Relation>>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await replica.listByUpdatedAt("relations", 1000);
        setRelations(data);
      } catch (error) {
        console.error("Failed to load relations:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [replica]);

  const columns: Array<Column<ReplicaRow<Relation>>> = [
    {
      key: "source_id",
      label: "Source",
      width: "160px",
      render: (row) => (
        <span className="font-mono text-xs">
          {row.source_id.slice(0, 8)}...
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
      key: "target_id",
      label: "Target",
      width: "160px",
      render: (row) => (
        <span className="font-mono text-xs">
          {row.target_id.slice(0, 8)}...
        </span>
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
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Relations</h2>
      </div>
      <DataTable
        columns={columns}
        data={relations}
        loading={loading}
        emptyMessage="No relations found."
      />
    </div>
  );
});
