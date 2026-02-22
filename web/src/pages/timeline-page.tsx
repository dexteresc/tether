import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimelineView, type TimelineEvent } from "@/components/timeline-view";
import { INTEL_TYPES } from "@/lib/constants";
import { capitalize, truncate } from "@/lib/utils";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Entity = RemoteRow<"entities">;
type Intel = RemoteRow<"intel">;
type EntityAttribute = RemoteRow<"entity_attributes">;
type Relation = RemoteRow<"relations">;
type Identifier = RemoteRow<"identifiers">;

function getEntityName(entity: ReplicaRow<Entity>, identifiers: Identifier[]): string {
  const data = entity.data as Record<string, unknown> | null;
  if (typeof data?.name === "string" && data.name) return data.name;
  const nameId = identifiers.find((i) => i.entity_id === entity.id && i.type === "name");
  return nameId?.value ?? entity.id.slice(0, 8) + "...";
}

export const TimelinePage = observer(function TimelinePage() {
  const { replica } = useRootStore();
  const [loading, setLoading] = useState(true);

  const [intelRecords, setIntelRecords] = useState<Array<ReplicaRow<Intel>>>([]);
  const [attributes, setAttributes] = useState<Array<ReplicaRow<EntityAttribute>>>([]);
  const [relations, setRelations] = useState<Array<ReplicaRow<Relation>>>([]);
  const [entities, setEntities] = useState<Array<ReplicaRow<Entity>>>([]);
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showIntel, setShowIntel] = useState(true);
  const [showAttributes, setShowAttributes] = useState(true);
  const [showRelations, setShowRelations] = useState(true);
  const [intelTypeFilter, setIntelTypeFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [intelData, attrsData, relData, entData, idData] = await Promise.all([
          replica.listByUpdatedAt("intel", 10000),
          replica.listByUpdatedAt("entity_attributes", 10000),
          replica.listByUpdatedAt("relations", 10000),
          replica.listByUpdatedAt("entities", 10000),
          replica.listByUpdatedAt("identifiers", 50000),
        ]);
        setIntelRecords(intelData.filter((i) => !i.deleted_at));
        setAttributes(attrsData.filter((a) => !a.deleted_at));
        setRelations(relData.filter((r) => !r.deleted_at));
        setEntities(entData.filter((e) => !e.deleted_at));
        setIdentifiers(idData.filter((i) => !i.deleted_at));
      } catch (error) {
        console.error("Failed to load timeline data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [replica]);

  // Build entity name map
  const entityNameMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    for (const e of entities) {
      map.set(e.id, { name: getEntityName(e, identifiers), type: e.type });
    }
    return map;
  }, [entities, identifiers]);

  // Build events
  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Intel events
    if (showIntel) {
      for (const intel of intelRecords) {
        if (intelTypeFilter && intel.type !== intelTypeFilter) continue;
        const data = intel.data as Record<string, unknown> | null;
        const desc = typeof data?.description === "string" ? data.description : "";
        events.push({
          id: `intel-${intel.id}`,
          date: intel.occurred_at,
          kind: "intel",
          title: `${intel.type}: ${desc ? truncate(desc, 80) : "No description"}`,
          confidence: intel.confidence,
          sensitivity: intel.sensitivity,
        });
      }
    }

    // Attribute events
    if (showAttributes) {
      for (const attr of attributes) {
        const info = entityNameMap.get(attr.entity_id);
        if (attr.valid_from) {
          events.push({
            id: `attr-start-${attr.id}`,
            date: attr.valid_from,
            kind: "attribute_start",
            title: `${attr.key.replace(/_/g, " ")} = ${attr.value}`,
            entityId: attr.entity_id,
            entityName: info?.name,
            confidence: attr.confidence,
          });
        }
        if (attr.valid_to) {
          events.push({
            id: `attr-end-${attr.id}`,
            date: attr.valid_to,
            kind: "attribute_end",
            title: `${attr.key.replace(/_/g, " ")} ended`,
            entityId: attr.entity_id,
            entityName: info?.name,
          });
        }
      }
    }

    // Relation events
    if (showRelations) {
      for (const rel of relations) {
        const srcInfo = entityNameMap.get(rel.source_id);
        const tgtInfo = entityNameMap.get(rel.target_id);
        const label = `${srcInfo?.name ?? rel.source_id.slice(0, 8)} → ${tgtInfo?.name ?? rel.target_id.slice(0, 8)} (${rel.type.replace(/_/g, " ")})`;
        if (rel.valid_from) {
          events.push({
            id: `rel-start-${rel.id}`,
            date: rel.valid_from,
            kind: "relation_start",
            title: label,
            entityId: rel.source_id,
            entityName: srcInfo?.name,
          });
        }
        if (rel.valid_to) {
          events.push({
            id: `rel-end-${rel.id}`,
            date: rel.valid_to,
            kind: "relation_end",
            title: `${label} ended`,
            entityId: rel.source_id,
            entityName: srcInfo?.name,
          });
        }
      }
    }

    return events;
  }, [intelRecords, attributes, relations, entityNameMap, showIntel, showAttributes, showRelations, intelTypeFilter]);

  // Apply date & entity filters
  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (dateFrom) {
      result = result.filter((e) => e.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((e) => e.date <= dateTo + "T23:59:59");
    }
    if (entityFilter) {
      const q = entityFilter.toLowerCase();
      result = result.filter((e) => e.entityName?.toLowerCase().includes(q));
    }
    return result;
  }, [allEvents, dateFrom, dateTo, entityFilter]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <h2 className="text-xl font-bold">Timeline</h2>
        <span className="text-sm text-muted-foreground">{filteredEvents.length} events</span>
      </div>

      {/* Filters */}
      <div className="p-3 border-b flex flex-wrap items-end gap-4 flex-shrink-0">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={showIntel} onChange={(e) => setShowIntel(e.target.checked)} />
            Intel
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={showAttributes} onChange={(e) => setShowAttributes(e.target.checked)} />
            Attributes
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={showRelations} onChange={(e) => setShowRelations(e.target.checked)} />
            Relations
          </label>
        </div>
        {showIntel && (
          <div>
            <Label className="text-xs">Intel Type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              value={intelTypeFilter}
              onChange={(e) => setIntelTypeFilter(e.target.value)}
            >
              <option value="">All</option>
              {INTEL_TYPES.map((t) => (
                <option key={t} value={t}>{capitalize(t)}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label className="text-xs">Entity</Label>
          <Input placeholder="Filter by entity..." value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-44" />
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <TimelineView events={filteredEvents} loading={loading} emptyMessage="No timeline events match your filters." />
      </div>
    </div>
  );
});
