import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Command } from "cmdk";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  searchEntitiesByIdentifier,
  fuzzySearchIdentifiers,
  searchIntelFullText,
} from "@/lib/supabase-helpers";
import { truncate, isRecord, str } from "@/lib/utils";

interface EntityResult {
  entity_id: string;
  entity_type: string;
  identifier_value: string;
}

interface IntelResult {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entityResults, setEntityResults] = useState<EntityResult[]>([]);
  const [intelResults, setIntelResults] = useState<IntelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setEntityResults([]);
      setIntelResults([]);
      return;
    }
    setLoading(true);
    try {
      const [prefixResults, fuzzyResults, intelData] = await Promise.all([
        searchEntitiesByIdentifier(q).catch(() => [] as unknown[]),
        fuzzySearchIdentifiers(q, 10).catch(() => [] as unknown[]),
        searchIntelFullText(q, 5).catch(() => [] as IntelResult[]),
      ]);

      // Merge entity results: prefix first, then fuzzy, deduplicated
      const seen = new Set<string>();
      const merged: EntityResult[] = [];
      for (const r of [...(prefixResults ?? []), ...(fuzzyResults ?? [])]) {
        if (!isRecord(r)) continue;
        const entityId = str(r.entity_id);
        if (!entityId || seen.has(entityId)) continue;
        seen.add(entityId);
        merged.push({
          entity_id: entityId,
          entity_type: str(r.entity_type, "unknown"),
          identifier_value: str(r.identifier_value) || entityId.slice(0, 8),
        });
      }
      setEntityResults(merged.slice(0, 10));
      setIntelResults(
        (intelData ?? []).map((i) => ({
          id: i.id,
          type: i.type,
          data: isRecord(i.data) ? i.data : null,
        }))
      );
    } catch {
      setEntityResults([]);
      setIntelResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => search(query), 250);
    } else {
      setEntityResults([]);
      setIntelResults([]);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  function selectEntity(id: string) {
    setOpen(false);
    setQuery("");
    navigate(`/entities/${id}`);
  }

  function selectIntel(id: string) {
    setOpen(false);
    setQuery("");
    navigate(`/intel`);
    // Could navigate to a detail page in the future
    void id;
  }

  const hasResults = entityResults.length > 0 || intelResults.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search across entities and intel
        </DialogDescription>
        <Command shouldFilter={false} className="rounded-lg">
          <div className="flex items-center border-b px-3">
            <svg className="mr-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search entities, intel..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            {loading && (
              <Command.Loading>
                <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
              </Command.Loading>
            )}
            {!loading && query.length >= 2 && !hasResults && (
              <Command.Empty className="p-4 text-sm text-muted-foreground text-center">
                No results found.
              </Command.Empty>
            )}
            {entityResults.length > 0 && (
              <Command.Group heading="Entities" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {entityResults.map((r) => (
                  <Command.Item
                    key={r.entity_id}
                    value={r.entity_id}
                    onSelect={() => selectEntity(r.entity_id)}
                    className="flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
                  >
                    <span className="font-medium">{r.identifier_value}</span>
                    <span className="text-xs text-muted-foreground capitalize">{r.entity_type}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {intelResults.length > 0 && (
              <Command.Group heading="Intel" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {intelResults.map((r) => {
                  const desc =
                    str(r.data?.description) ||
                    str(r.data?.content) ||
                    r.type;
                  return (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => selectIntel(r.id)}
                      className="flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
                    >
                      <span>{truncate(desc, 60)}</span>
                      <span className="text-xs text-muted-foreground capitalize">{r.type}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
            {!loading && query.length < 2 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Type to search across entities and intel...
              </div>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
