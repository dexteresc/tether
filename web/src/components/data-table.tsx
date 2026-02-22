import { observer } from "mobx-react-lite";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  width?: string;
}

interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFn?: (row: T, query: string) => boolean;
  filters?: FilterDef[];
  filterFn?: (row: T, activeFilters: Record<string, string>) => boolean;
}

const selectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export const DataTable = observer(function DataTable<T>({
  columns,
  data,
  loading = false,
  onRowClick,
  emptyMessage = "No data available",
  pageSize = 50,
  searchable = false,
  searchPlaceholder = "Search...",
  searchFn,
  filters,
  filterFn,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const filteredData = useMemo(() => {
    let result = data;

    if (searchable && searchFn && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((row) => searchFn(row, q));
    }

    if (filters && filterFn) {
      const hasActive = Object.values(activeFilters).some((v) => v !== "");
      if (hasActive) {
        result = result.filter((row) => filterFn(row, activeFilters));
      }
    }

    return result;
  }, [data, searchable, searchFn, searchQuery, filters, filterFn, activeFilters]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredData.length);
  const currentData = filteredData.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
  };

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  };

  const hasToolbar = searchable || (filters && filters.length > 0);

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (data.length === 0 && !hasToolbar) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="p-4">
      {hasToolbar && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {searchable && (
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="max-w-xs"
            />
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              className={selectClass}
              value={activeFilters[f.key] ?? ""}
              onChange={(e) => handleFilterChange(f.key, e.target.value)}
            >
              <option value="">{f.label}</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {filteredData.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          {searchQuery || Object.values(activeFilters).some((v) => v)
            ? "No matching results."
            : emptyMessage}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="p-3 text-left font-medium text-muted-foreground"
                      style={{ width: col.width }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b transition-colors ${
                      onRowClick
                        ? "cursor-pointer hover:bg-muted/50"
                        : ""
                    }`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="p-3">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{endIndex} of {filteredData.length}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(0)}
                  disabled={currentPage === 0}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="flex items-center px-2 text-sm text-muted-foreground">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages - 1}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages - 1)}
                  disabled={currentPage === totalPages - 1}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
