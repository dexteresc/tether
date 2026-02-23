import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { nominatimSearch, type NominatimResult } from "@/lib/geo";

export interface LocationValue {
  lat: number;
  lng: number;
  display_name: string;
}

interface LocationSearchProps {
  value: LocationValue | undefined;
  onChange: (value: LocationValue | undefined) => void;
}

export function LocationSearch({ value, onChange }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await nominatimSearch(q, 5);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => search(query), 300);
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

  function handleSelect(result: NominatimResult) {
    onChange({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      display_name: result.display_name,
    });
    setQuery("");
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    onChange(undefined);
    setQuery("");
    setResults([]);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-sm truncate max-w-[300px]" title={value.display_name}>
          {value.display_name}
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground text-sm px-1"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder="Search for a place..."
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onClick={() => handleSelect(r)}
            >
              {r.display_name}
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
