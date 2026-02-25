import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { fuzzySearchIdentifiers } from "@/lib/supabase-helpers";
import { capitalize } from "@/lib/utils";

interface SearchResult {
  entity_id: string;
  entity_type: string;
  identifier_value: string;
}

interface EntitySearchInputProps {
  value: string | undefined;
  onChange: (entityId: string | undefined, label: string) => void;
  placeholder?: string;
  className?: string;
}

export function EntitySearchInput({
  value,
  onChange,
  placeholder = "Search entities...",
  className,
}: EntitySearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fuzzySearchIdentifiers(q, 10);
      // Deduplicate by entity_id, keep first (best) match
      const seen = new Set<string>();
      const deduped: SearchResult[] = [];
      for (const r of data) {
        const row = r as { entity_id: string; entity_type: string; identifier_value?: string };
        if (!seen.has(row.entity_id)) {
          seen.add(row.entity_id);
          deduped.push({
            entity_id: row.entity_id,
            entity_type: row.entity_type ?? "unknown",
            identifier_value: row.identifier_value ?? row.entity_id.slice(0, 8),
          });
        }
      }
      setResults(deduped);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => search(query), 200);
    } else {
      setResults([]);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: SearchResult) {
    const label = `${result.identifier_value} (${capitalize(result.entity_type)})`;
    setSelectedLabel(label);
    setQuery(result.identifier_value);
    setOpen(false);
    onChange(result.entity_id, label);
  }

  function handleClear() {
    setQuery("");
    setSelectedLabel("");
    onChange(undefined, "");
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-1">
        <Input
          value={value && selectedLabel ? selectedLabel : query}
          onChange={(e) => {
            if (value && selectedLabel) {
              handleClear();
              setQuery(e.target.value);
            } else {
              setQuery(e.target.value);
            }
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground text-xs px-1"
          >
            &times;
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
          {results.map((r) => (
            <button
              key={r.entity_id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between"
              onClick={() => handleSelect(r)}
            >
              <span className="font-medium">{r.identifier_value}</span>
              <span className="text-xs text-muted-foreground capitalize">{r.entity_type}</span>
            </button>
          ))}
        </div>
      )}
      {open && loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md p-3 text-sm text-muted-foreground">
          Searching...
        </div>
      )}
    </div>
  );
}
