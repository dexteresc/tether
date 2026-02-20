import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import { DataTable, type Column } from "@/components/data-table";
import type { Intel } from "@/types/database";
import type { ReplicaRow } from "@/lib/sync/types";

export const IntelPage = observer(function IntelPage() {
  const { replica } = useRootStore();
  const [intel, setIntel] = useState<Array<ReplicaRow<Intel>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    load();
  }, [replica]);

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
      key: "source_id",
      label: "Source",
      width: "200px",
      render: (row) => (
        <span className="font-mono text-xs">
          {row.source_id ? row.source_id.slice(0, 8) + "..." : "N/A"}
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
        <h2 className="text-xl font-bold">Intel</h2>
      </div>
      <DataTable
        columns={columns}
        data={intel}
        loading={loading}
        emptyMessage="No intel records found."
      />
    </div>
  );
});
