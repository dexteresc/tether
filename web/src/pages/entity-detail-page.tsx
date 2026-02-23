import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useRootStore } from "@/hooks/use-root-store";
import { SensitivityBadge } from "@/components/sensitivity-badge";
import { SensitivityPicker } from "@/components/sensitivity-picker";
import { EntityLink } from "@/components/entity-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/data-table";
import { createRecord } from "@/services/sync/createRecord";
import { updateRecord } from "@/services/sync/updateRecord";
import { softDeleteRecord } from "@/services/sync/deleteRecord";
import {
  ENTITY_TYPES,
  ENTITY_STATUSES,
  CONFIDENCE_LEVELS,
  ATTRIBUTE_DEFINITIONS,
  IDENTIFIER_TYPES,
  RELATION_TYPES,
  TAG_CATEGORIES,
} from "@/lib/constants";
import { LocationSearch, type LocationValue } from "@/components/location-search";
import { TimelineView, type TimelineEvent } from "@/components/timeline-view";
import { getLatLngFromData, getLocationName, nominatimReverse } from "@/lib/geo";
import { capitalize, formatLabel, truncate, selectClass, CONFIDENCE_COLORS, CONFIDENCE_DOT_COLORS, isRecord } from "@/lib/utils";
import { EntityBriefing } from "@/components/entity-briefing";
import { MiniGraph } from "@/components/mini-graph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, Plus, Trash2 } from "lucide-react";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Entity = RemoteRow<"entities">;
type Identifier = RemoteRow<"identifiers">;
type EntityAttribute = RemoteRow<"entity_attributes">;
type Relation = RemoteRow<"relations">;
type IntelEntity = RemoteRow<"intel_entities">;
type Intel = RemoteRow<"intel">;
type Tag = RemoteRow<"tags">;
type RecordTag = RemoteRow<"record_tags">;

function getEntityName(entity: ReplicaRow<Entity>, identifiers: Identifier[]): string {
  const data = isRecord(entity.data) ? entity.data : undefined;
  if (typeof data?.name === "string" && data.name) return data.name;
  const nameId = identifiers.find((i) => i.entity_id === entity.id && i.type === "name");
  return nameId?.value ?? entity.id.slice(0, 8) + "...";
}

export const EntityDetailPage = observer(function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { replica, outbox } = useRootStore();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<ReplicaRow<Entity> | undefined>(undefined);
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]);
  const [attributes, setAttributes] = useState<Array<ReplicaRow<EntityAttribute>>>([]);
  const [relations, setRelations] = useState<Array<ReplicaRow<Relation>>>([]);
  const [intelLinks, setIntelLinks] = useState<Array<ReplicaRow<IntelEntity>>>([]);
  const [intelRecords, setIntelRecords] = useState<Map<string, ReplicaRow<Intel>>>(new Map());
  const [recordTags, setRecordTags] = useState<Array<ReplicaRow<RecordTag>>>([]);
  const [allEntities, setAllEntities] = useState<Array<ReplicaRow<Entity>>>([]);
  const [allIdentifiers, setAllIdentifiers] = useState<Identifier[]>([]);
  const [allTags, setAllTags] = useState<Array<ReplicaRow<Tag>>>([]);
  const [loading, setLoading] = useState(true);

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editSensitivity, setEditSensitivity] = useState("");
  const [editName, setEditName] = useState("");

  // Add attribute sheet
  const [attrSheetOpen, setAttrSheetOpen] = useState(false);
  const [attrKey, setAttrKey] = useState("");
  const [attrValue, setAttrValue] = useState("");
  const [attrValidFrom, setAttrValidFrom] = useState("");
  const [attrValidTo, setAttrValidTo] = useState("");
  const [attrConfidence, setAttrConfidence] = useState("medium");
  const [attrNotes, setAttrNotes] = useState("");

  // Add relation sheet
  const [relSheetOpen, setRelSheetOpen] = useState(false);
  const [relDirection, setRelDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [relOtherId, setRelOtherId] = useState("");
  const [relType, setRelType] = useState<string>(RELATION_TYPES[0]);
  const [relStrength, setRelStrength] = useState("");
  const [relSensitivity, setRelSensitivity] = useState("internal");
  const [relValidFrom, setRelValidFrom] = useState("");
  const [relValidTo, setRelValidTo] = useState("");

  // Add identifier sheet
  const [idSheetOpen, setIdSheetOpen] = useState(false);
  const [idType, setIdType] = useState("name");
  const [idValue, setIdValue] = useState("");

  // Add tag sheet
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("topic");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

  // Inline attribute editing
  const [editingAttrId, setEditingAttrId] = useState<string | undefined>(undefined);
  const [editingAttrValue, setEditingAttrValue] = useState("");

  // Briefing
  const [briefingOpen, setBriefingOpen] = useState(false);

  // Edit location
  const [editLocation, setEditLocation] = useState<LocationValue | undefined>(undefined);

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const entityData = await replica.getById("entities", id);
      if (!entityData) {
        setEntity(undefined);
        setLoading(false);
        return;
      }
      setEntity(entityData);

      const [identifiersAll, attrsAll, relationsAll, intelEntitiesAll, intelAll, tagsAll, recordTagsAll, entitiesAll] =
        await Promise.all([
          replica.listByUpdatedAt("identifiers", 50000),
          replica.listByUpdatedAt("entity_attributes", 10000),
          replica.listByUpdatedAt("relations", 10000),
          replica.listByUpdatedAt("intel_entities", 10000),
          replica.listByUpdatedAt("intel", 10000),
          replica.listByUpdatedAt("tags", 1000),
          replica.listByUpdatedAt("record_tags", 10000),
          replica.listByUpdatedAt("entities", 10000),
        ]);

      setAllIdentifiers(identifiersAll.filter((i) => !i.deleted_at));
      setIdentifiers(identifiersAll.filter((i) => i.entity_id === id && !i.deleted_at));
      setAttributes(attrsAll.filter((a) => a.entity_id === id && !a.deleted_at));
      setRelations(relationsAll.filter((r) => (r.source_id === id || r.target_id === id) && !r.deleted_at));
      setIntelLinks(intelEntitiesAll.filter((ie) => ie.entity_id === id && !ie.deleted_at));

      const intelMap = new Map<string, ReplicaRow<Intel>>();
      for (const i of intelAll) {
        if (!i.deleted_at) intelMap.set(i.id, i);
      }
      setIntelRecords(intelMap);

      setAllTags(tagsAll.filter((t) => !t.deleted_at));
      setRecordTags(recordTagsAll.filter((rt) => rt.record_id === id && rt.record_table === "entities" && !rt.deleted_at));
      setAllEntities(entitiesAll.filter((e) => !e.deleted_at));
    } catch (error) {
      console.error("Failed to load entity:", error);
    } finally {
      setLoading(false);
    }
  }, [id, replica]);

  useEffect(() => {
    load();
  }, [load]);

  // Entity name helpers
  const entityNameMap = new Map<string, { name: string; type: string }>();
  for (const e of allEntities) {
    entityNameMap.set(e.id, {
      name: getEntityName(e, allIdentifiers),
      type: e.type,
    });
  }

  function openEditSheet() {
    if (!entity) return;
    setEditType(entity.type);
    setEditStatus(entity.status);
    setEditSensitivity(entity.sensitivity);
    const data = isRecord(entity.data) ? entity.data : undefined;
    setEditName(typeof data?.name === "string" ? data.name : "");
    const coords = getLatLngFromData(entity.data);
    const locName = getLocationName(entity.data);
    setEditLocation(coords ? { lat: coords.lat, lng: coords.lng, display_name: locName ?? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` } : undefined);
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!entity) return;
    setSaving(true);
    try {
      const existingData = isRecord(entity.data) ? entity.data : {};
      const updatedData: Record<string, unknown> = { ...existingData, name: editName.trim() };
      if (editLocation) {
        updatedData.lat = editLocation.lat;
        updatedData.lng = editLocation.lng;
        updatedData.location_name = editLocation.display_name;
      } else {
        delete updatedData.lat;
        delete updatedData.lng;
        delete updatedData.location_name;
      }
      await updateRecord("entities", entity.id, {
        type: editType,
        status: editStatus,
        sensitivity: editSensitivity,
        data: updatedData as RemoteRow<"entities">["data"],
      });
      await outbox.refresh();
      await load();
      setEditOpen(false);
    } catch (error) {
      console.error("Failed to update entity:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddIdentifier(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !idValue.trim()) return;
    setSaving(true);
    try {
      await createRecord("identifiers", {
        entity_id: id,
        type: idType,
        value: idValue.trim(),
        metadata: {},
      });
      await outbox.refresh();
      await load();
      setIdSheetOpen(false);
      setIdValue("");
    } catch (error) {
      console.error("Failed to add identifier:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIdentifier(identifierId: string) {
    setSaving(true);
    try {
      await softDeleteRecord("identifiers", identifierId);
      await outbox.refresh();
      await load();
    } catch (error) {
      console.error("Failed to delete identifier:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAttribute(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !attrKey.trim() || !attrValue.trim()) return;
    setSaving(true);
    try {
      await createRecord("entity_attributes", {
        entity_id: id,
        key: attrKey.trim(),
        value: attrValue.trim(),
        valid_from: attrValidFrom || null,
        valid_to: attrValidTo || null,
        confidence: attrConfidence,
        notes: attrNotes || null,
        source_id: null,
      });
      await outbox.refresh();
      await load();
      setAttrSheetOpen(false);
      setAttrKey("");
      setAttrValue("");
      setAttrValidFrom("");
      setAttrValidTo("");
      setAttrConfidence("medium");
      setAttrNotes("");
    } catch (error) {
      console.error("Failed to add attribute:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRelation(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !relOtherId) return;
    setSaving(true);
    try {
      const sourceId = relDirection === "outgoing" ? id : relOtherId;
      const targetId = relDirection === "outgoing" ? relOtherId : id;
      await createRecord("relations", {
        source_id: sourceId,
        target_id: targetId,
        type: relType,
        strength: relStrength ? Number(relStrength) : null,
        sensitivity: relSensitivity,
        data: null,
        valid_from: relValidFrom || null,
        valid_to: relValidTo || null,
      });
      await outbox.refresh();
      await load();
      setRelSheetOpen(false);
      setRelOtherId("");
      setRelStrength("");
      setRelSensitivity("internal");
      setRelValidFrom("");
      setRelValidTo("");
    } catch (error) {
      console.error("Failed to add relation:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      let tagId = selectedTagId;
      if (!tagId && newTagName.trim()) {
        tagId = await createRecord("tags", {
          name: newTagName.trim(),
          category: newTagCategory,
          color: newTagColor,
        });
      }
      if (!tagId) return;
      await createRecord("record_tags", {
        record_id: id,
        record_table: "entities",
        tag_id: tagId,
      });
      await outbox.refresh();
      await load();
      setTagSheetOpen(false);
      setSelectedTagId("");
      setNewTagName("");
    } catch (error) {
      console.error("Failed to add tag:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveTag(recordTagId: string) {
    setSaving(true);
    try {
      await softDeleteRecord("record_tags", recordTagId);
      await outbox.refresh();
      await load();
    } catch (error) {
      console.error("Failed to remove tag:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleInlineAttrSave(attrId: string, newValue: string) {
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await updateRecord("entity_attributes", attrId, { value: newValue.trim() } as Partial<EntityAttribute>);
      await outbox.refresh();
      await load();
    } catch (error) {
      console.error("Failed to update attribute:", error);
    } finally {
      setSaving(false);
      setEditingAttrId(undefined);
    }
  }

  async function handleDeleteAttribute(attrId: string) {
    setSaving(true);
    try {
      await softDeleteRecord("entity_attributes", attrId);
      await outbox.refresh();
      await load();
    } catch (error) {
      console.error("Failed to delete attribute:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  if (!entity) {
    return (
      <div className="p-6">
        <p>Entity not found</p>
        <Link to="/entities" className="text-primary hover:underline">
          Back to Entities
        </Link>
      </div>
    );
  }

  const entityName = getEntityName(entity, identifiers);
  const currentAttrs = attributes.filter((a) => !a.valid_to);
  const historicalAttrs = attributes.filter((a) => !!a.valid_to);

  // Attribute key autocomplete suggestions
  const attrKeySuggestions = ATTRIBUTE_DEFINITIONS.filter(
    (d) => d.applies_to.includes(entity.type as never)
  );

  // Tag resolution
  const tagMap = new Map<string, ReplicaRow<Tag>>();
  for (const t of allTags) tagMap.set(t.id, t);

  const assignedTagIds = new Set(recordTags.map((rt) => rt.tag_id));
  const availableTags = allTags.filter((t) => !assignedTagIds.has(t.id));

  // Relation columns
  const relationColumns: Array<Column<ReplicaRow<Relation>>> = [
    {
      key: "direction",
      label: "Dir",
      width: "70px",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.source_id === id ? "out" : "in"}
        </span>
      ),
    },
    {
      key: "entity",
      label: "Connected Entity",
      render: (row) => {
        const otherId = row.source_id === id ? row.target_id : row.source_id;
        const info = entityNameMap.get(otherId);
        return (
          <EntityLink
            id={otherId}
            name={info?.name ?? otherId.slice(0, 8) + "..."}
            type={info?.type}
          />
        );
      },
    },
    {
      key: "type",
      label: "Type",
      width: "130px",
      render: (row) => <span className="capitalize">{row.type}</span>,
    },
    {
      key: "strength",
      label: "Str",
      width: "60px",
      render: (row) => <span>{row.strength ?? "-"}</span>,
    },
    {
      key: "valid_from",
      label: "From",
      width: "100px",
      render: (row) => (row.valid_from ? new Date(row.valid_from).toLocaleDateString() : "-"),
    },
    {
      key: "valid_to",
      label: "To",
      width: "100px",
      render: (row) => (row.valid_to ? new Date(row.valid_to).toLocaleDateString() : "-"),
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      width: "110px",
      render: (row) => <SensitivityBadge level={row.sensitivity} />,
    },
  ];

  // Intel columns
  const intelColumns: Array<Column<ReplicaRow<IntelEntity>>> = [
    {
      key: "type",
      label: "Type",
      width: "120px",
      render: (row) => {
        const intel = intelRecords.get(row.intel_id);
        return <span className="capitalize">{intel?.type ?? "?"}</span>;
      },
    },
    {
      key: "description",
      label: "Description",
      render: (row) => {
        const intel = intelRecords.get(row.intel_id);
        if (!intel) return <span className="text-muted-foreground">-</span>;
        const data = isRecord(intel.data) ? intel.data : undefined;
        const desc = typeof data?.description === "string" ? data.description : "";
        return (
          <span className="truncate block max-w-sm" title={desc}>
            {desc ? truncate(desc, 60) : "-"}
          </span>
        );
      },
    },
    {
      key: "occurred_at",
      label: "Occurred",
      width: "140px",
      render: (row) => {
        const intel = intelRecords.get(row.intel_id);
        return intel ? new Date(intel.occurred_at).toLocaleDateString() : "-";
      },
    },
    {
      key: "confidence",
      label: "Confidence",
      width: "100px",
      render: (row) => {
        const intel = intelRecords.get(row.intel_id);
        return <span className="capitalize">{intel?.confidence ?? "-"}</span>;
      },
    },
    {
      key: "role",
      label: "Role",
      width: "100px",
      render: (row) => <span className="capitalize">{row.role || "-"}</span>,
    },
  ];

  // Attribute columns
  const attrColumns: Array<Column<ReplicaRow<EntityAttribute>>> = [
    {
      key: "key",
      label: "Key",
      width: "140px",
      render: (row) => <span className="font-medium capitalize">{row.key.replace(/_/g, " ")}</span>,
    },
    {
      key: "value",
      label: "Value",
      render: (row) => {
        if (editingAttrId === row.id) {
          return (
            <Input
              autoFocus
              value={editingAttrValue}
              onChange={(e) => setEditingAttrValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInlineAttrSave(row.id, editingAttrValue);
                if (e.key === "Escape") setEditingAttrId(undefined);
              }}
              onBlur={() => setEditingAttrId(undefined)}
              className="h-7 text-sm"
            />
          );
        }
        return (
          <button
            type="button"
            className="text-left hover:underline cursor-pointer"
            onClick={() => {
              setEditingAttrId(row.id);
              setEditingAttrValue(row.value);
            }}
          >
            {row.value}
          </button>
        );
      },
    },
    {
      key: "valid_from",
      label: "From",
      width: "110px",
      render: (row) => (row.valid_from ? new Date(row.valid_from).toLocaleDateString() : "-"),
    },
    {
      key: "valid_to",
      label: "To",
      width: "110px",
      render: (row) => (row.valid_to ? new Date(row.valid_to).toLocaleDateString() : "-"),
    },
    {
      key: "confidence",
      label: "Confidence",
      width: "100px",
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 capitalize">
          <span className={`inline-block w-2 h-2 rounded-full ${CONFIDENCE_DOT_COLORS[row.confidence] ?? "bg-gray-400"}`} />
          <span className={CONFIDENCE_COLORS[row.confidence] ?? ""}>{row.confidence}</span>
        </span>
      ),
    },
    {
      key: "notes",
      label: "Notes",
      width: "140px",
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[120px]">
          {row.notes || "-"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "40px",
      render: (row) => (
        <button
          type="button"
          onClick={() => handleDeleteAttribute(row.id)}
          className="text-muted-foreground hover:text-destructive"
          disabled={saving}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  // Key attribute chips — priority-ordered
  const keyAttrKeys = ["job_title", "employer", "city", "country", "industry", "headquarters"];
  const keyAttrChips = keyAttrKeys
    .map((k) => {
      const attr = currentAttrs.find((a) => a.key === k);
      return attr ? { key: k, value: attr.value } : undefined;
    })
    .filter((x): x is { key: string; value: string } => !!x)
    .slice(0, 4);

  return (
    <div>
      {/* Header */}
      <div className="p-4 border-b">
        <Link to="/entities" className="text-sm text-primary hover:underline">
          &larr; Back to Entities
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold">{entityName}</h2>
            <span className="capitalize px-2 py-0.5 bg-muted rounded text-xs font-medium">
              {entity.type}
            </span>
            <span className="capitalize px-2 py-0.5 bg-muted rounded text-xs">
              {entity.status}
            </span>
            <SensitivityBadge level={entity.sensitivity} />
            {keyAttrChips.map((chip) => (
              <span key={chip.key} className="bg-muted px-2 py-0.5 rounded text-xs">
                {chip.value}
              </span>
            ))}
            {recordTags.map((rt) => {
              const tag = tagMap.get(rt.tag_id);
              return (
                <span
                  key={rt.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: tag?.color ? tag.color + "20" : undefined,
                    color: tag?.color || undefined,
                    border: `1px solid ${tag?.color || "#888"}`,
                  }}
                >
                  {tag?.name ?? "Unknown"}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setBriefingOpen(true)}>
              Briefing
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIdSheetOpen(true)}>Identifier</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAttrSheetOpen(true)}>Attribute</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRelSheetOpen(true)}>Relation</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTagSheetOpen(true)}>Tag</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" onClick={openEditSheet}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attributes">Attributes ({attributes.length})</TabsTrigger>
            <TabsTrigger value="relations">Relations ({relations.length})</TabsTrigger>
            <TabsTrigger value="intel">Intel ({intelLinks.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="tags">Tags ({recordTags.length})</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="space-y-6 pt-4">
              {/* Stat bar */}
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{attributes.length}</span> attributes
                {" · "}
                <span className="font-medium text-foreground">{relations.length}</span> relations
                {" · "}
                <span className="font-medium text-foreground">{intelLinks.length}</span> intel
                {" · "}
                <span className="font-medium text-foreground">{recordTags.length}</span> tags
              </p>

              {/* About */}
              <div>
                <h3 className="text-sm font-medium mb-2">About</h3>
                <AboutField entityId={entity.id} attributes={attributes} onSave={async () => { await outbox.refresh(); await load(); }} />
              </div>

              {/* Identifiers — simplified inline list */}
              <div>
                <h3 className="text-sm font-medium mb-2">Identifiers</h3>
                {identifiers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No identifiers</p>
                ) : (
                  <div className="space-y-1">
                    {identifiers.map((ident) => (
                      <div key={ident.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="capitalize text-xs text-muted-foreground w-20">{ident.type}</span>
                          <span className="font-mono">{ident.value}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteIdentifier(ident.id)}
                          className="text-muted-foreground hover:text-destructive text-xs"
                          disabled={saving}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Location */}
              <EntityLocationDisplay entity={entity} onUpdate={async () => { await outbox.refresh(); await load(); }} />

              {/* Recent Activity + Mini Graph side by side */}
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-medium mb-2">Recent Activity</h3>
                  <RecentActivity
                    entityId={id!}
                    relations={relations}
                    intelLinks={intelLinks}
                    intelRecords={intelRecords}
                    entityNameMap={entityNameMap}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Network</h3>
                  <MiniGraph entityId={id!} height={250} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Attributes */}
          <TabsContent value="attributes">
            <div className="pt-4 space-y-4">
              <h3 className="font-medium">Current Attributes</h3>
              {currentAttrs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No current attributes.</p>
              ) : (
                <DataTable columns={attrColumns} data={currentAttrs} pageSize={20} />
              )}

              {historicalAttrs.length > 0 && (
                <>
                  <h3 className="font-medium text-muted-foreground">Historical</h3>
                  <DataTable columns={attrColumns} data={historicalAttrs} pageSize={20} />
                </>
              )}
            </div>
          </TabsContent>

          {/* Relations */}
          <TabsContent value="relations">
            <div className="pt-4 space-y-4">
              <h3 className="font-medium">Relations</h3>
              <DataTable
                columns={relationColumns}
                data={relations}
                emptyMessage="No relations."
                onRowClick={(row) => {
                  const otherId = row.source_id === id ? row.target_id : row.source_id;
                  navigate(`/entities/${otherId}`);
                }}
              />
            </div>
          </TabsContent>

          {/* Intel */}
          <TabsContent value="intel">
            <div className="pt-4">
              <h3 className="font-medium mb-4">Linked Intel</h3>
              <DataTable
                columns={intelColumns}
                data={intelLinks}
                emptyMessage="No intel linked to this entity."
              />
            </div>
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline">
            <EntityTimeline
              entity={entity}
              attributes={attributes}
              relations={relations}
              intelLinks={intelLinks}
              intelRecords={intelRecords}
              entityNameMap={entityNameMap}
            />
          </TabsContent>

          {/* Tags */}
          <TabsContent value="tags">
            <div className="pt-4 space-y-4">
              <h3 className="font-medium">Tags</h3>
              {recordTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recordTags.map((rt) => {
                    const tag = tagMap.get(rt.tag_id);
                    return (
                      <span
                        key={rt.id}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: tag?.color ? tag.color + "20" : undefined,
                          color: tag?.color || undefined,
                          border: `1px solid ${tag?.color || "#888"}`,
                        }}
                      >
                        {tag?.name ?? "Unknown"}
                        <button
                          onClick={() => handleRemoveTag(rt.id)}
                          className="ml-1 hover:opacity-70"
                          disabled={saving}
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Briefing Sheet */}
      <EntityBriefing
        entityId={id!}
        entityName={entityName}
        open={briefingOpen}
        onOpenChange={setBriefingOpen}
      />

      {/* Edit Entity Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Entity</SheetTitle>
            <SheetDescription>Update entity details.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="editName">Name</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="editType">Type</Label>
              <select id="editType" className={selectClass} value={editType} onChange={(e) => setEditType(e.target.value)}>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>{capitalize(t)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="editStatus">Status</Label>
              <select id="editStatus" className={selectClass} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {ENTITY_STATUSES.map((s) => (
                  <option key={s} value={s}>{capitalize(s)}</option>
                ))}
              </select>
            </div>
            <SensitivityPicker value={editSensitivity} onChange={setEditSensitivity} />
            <div className="flex flex-col gap-2">
              <Label>Location</Label>
              <LocationSearch value={editLocation} onChange={setEditLocation} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add Identifier Sheet */}
      <Sheet open={idSheetOpen} onOpenChange={setIdSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Identifier</SheetTitle>
            <SheetDescription>Add a new identifier to this entity.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddIdentifier} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="idType">Type</Label>
              <select id="idType" className={selectClass} value={idType} onChange={(e) => setIdType(e.target.value)}>
                {IDENTIFIER_TYPES.map((t) => (
                  <option key={t} value={t}>{formatLabel(t)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="idValue">Value</Label>
              <Input id="idValue" value={idValue} onChange={(e) => setIdValue(e.target.value)} required />
            </div>
            <Button type="submit" disabled={saving || !idValue.trim()}>
              {saving ? "Adding..." : "Add Identifier"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add Attribute Sheet */}
      <Sheet open={attrSheetOpen} onOpenChange={setAttrSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Attribute</SheetTitle>
            <SheetDescription>Add an attribute to this entity.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddAttribute} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="attrKey">Key</Label>
              <Input
                id="attrKey"
                list="attrKeySuggestions"
                value={attrKey}
                onChange={(e) => setAttrKey(e.target.value)}
                placeholder="e.g. employer"
                required
              />
              <datalist id="attrKeySuggestions">
                {attrKeySuggestions.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="attrValue">Value</Label>
              <Input id="attrValue" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="attrValidFrom">Valid From</Label>
                <Input id="attrValidFrom" type="date" value={attrValidFrom} onChange={(e) => setAttrValidFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="attrValidTo">Valid To</Label>
                <Input id="attrValidTo" type="date" value={attrValidTo} onChange={(e) => setAttrValidTo(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="attrConfidence">Confidence</Label>
              <select id="attrConfidence" className={selectClass} value={attrConfidence} onChange={(e) => setAttrConfidence(e.target.value)}>
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>{capitalize(c)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="attrNotes">Notes</Label>
              <Input id="attrNotes" value={attrNotes} onChange={(e) => setAttrNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving || !attrKey.trim() || !attrValue.trim()}>
              {saving ? "Adding..." : "Add Attribute"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add Relation Sheet */}
      <Sheet open={relSheetOpen} onOpenChange={setRelSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Relation</SheetTitle>
            <SheetDescription>Create a relation from/to this entity.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddRelation} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label>Direction</Label>
              <select className={selectClass} value={relDirection} onChange={(e) => setRelDirection(e.target.value as "outgoing" | "incoming")}>
                <option value="outgoing">Outgoing (this &rarr; other)</option>
                <option value="incoming">Incoming (other &rarr; this)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="relOther">Other Entity</Label>
              <select id="relOther" className={selectClass} value={relOtherId} onChange={(e) => setRelOtherId(e.target.value)} required>
                <option value="" disabled>Select entity...</option>
                {allEntities.filter((e) => e.id !== id).map((e) => {
                  const info = entityNameMap.get(e.id);
                  return (
                    <option key={e.id} value={e.id}>
                      {info?.name ?? e.id.slice(0, 8)} ({e.type})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="relType">Type</Label>
              <select id="relType" className={selectClass} value={relType} onChange={(e) => setRelType(e.target.value)}>
                {RELATION_TYPES.map((t) => (
                  <option key={t} value={t}>{formatLabel(t)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="relStrength">Strength (optional)</Label>
              <Input id="relStrength" type="number" min="1" max="10" value={relStrength} onChange={(e) => setRelStrength(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="relValidFrom">Valid From</Label>
                <Input id="relValidFrom" type="date" value={relValidFrom} onChange={(e) => setRelValidFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="relValidTo">Valid To</Label>
                <Input id="relValidTo" type="date" value={relValidTo} onChange={(e) => setRelValidTo(e.target.value)} />
              </div>
            </div>
            <SensitivityPicker value={relSensitivity} onChange={setRelSensitivity} />
            <Button type="submit" disabled={saving || !relOtherId}>
              {saving ? "Adding..." : "Add Relation"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add Tag Sheet */}
      <Sheet open={tagSheetOpen} onOpenChange={setTagSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Tag</SheetTitle>
            <SheetDescription>Assign an existing tag or create a new one.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddTag} className="flex flex-col gap-4 p-4">
            {availableTags.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="existingTag">Existing Tag</Label>
                <select id="existingTag" className={selectClass} value={selectedTagId} onChange={(e) => { setSelectedTagId(e.target.value); if (e.target.value) setNewTagName(""); }}>
                  <option value="">-- Select or create new --</option>
                  {availableTags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>
            )}
            {!selectedTagId && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="newTagName">New Tag Name</Label>
                  <Input id="newTagName" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="newTagCategory">Category</Label>
                  <select id="newTagCategory" className={selectClass} value={newTagCategory} onChange={(e) => setNewTagCategory(e.target.value)}>
                    {TAG_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{capitalize(c)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="newTagColor">Color</Label>
                  <Input id="newTagColor" type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
                </div>
              </>
            )}
            <Button type="submit" disabled={saving || (!selectedTagId && !newTagName.trim())}>
              {saving ? "Adding..." : "Add Tag"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
});

// --- Entity Location Display (Overview tab) ---

function EntityLocationDisplay({
  entity,
  onUpdate,
}: {
  entity: ReplicaRow<Entity>;
  onUpdate: () => Promise<void>;
}) {
  const coords = getLatLngFromData(entity.data);
  const locationName = getLocationName(entity.data);
  const backfillDone = useRef(false);

  useEffect(() => {
    if (!coords || locationName || backfillDone.current) return;
    backfillDone.current = true;
    nominatimReverse(coords.lat, coords.lng).then(async (name) => {
      if (!name) return;
      const existingData = isRecord(entity.data) ? entity.data : {};
      await updateRecord("entities", entity.id, {
        data: { ...existingData, location_name: name },
      });
      await onUpdate();
    }).catch(() => {});
  }, [coords, locationName, entity, onUpdate]);

  const displayName = locationName ?? (coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : null);
  if (!displayName) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
      <span>{displayName}</span>
    </div>
  );
}

// --- Entity Timeline ---

function EntityTimeline({
  entity,
  attributes,
  relations,
  intelLinks,
  intelRecords,
  entityNameMap,
}: {
  entity: ReplicaRow<Entity>;
  attributes: Array<ReplicaRow<EntityAttribute>>;
  relations: Array<ReplicaRow<Relation>>;
  intelLinks: Array<ReplicaRow<IntelEntity>>;
  intelRecords: Map<string, ReplicaRow<Intel>>;
  entityNameMap: Map<string, { name: string; type: string }>;
}) {
  const events: TimelineEvent[] = [];

  // Entity creation
  events.push({
    id: `lifecycle-${entity.id}`,
    date: entity.created_at,
    kind: "lifecycle",
    title: "Entity created",
  });

  // Attributes
  for (const attr of attributes) {
    if (attr.valid_from) {
      events.push({
        id: `attr-start-${attr.id}`,
        date: attr.valid_from,
        kind: "attribute_start",
        title: `${attr.key.replace(/_/g, " ")} = ${attr.value}`,
        confidence: attr.confidence,
      });
    }
    if (attr.valid_to) {
      events.push({
        id: `attr-end-${attr.id}`,
        date: attr.valid_to,
        kind: "attribute_end",
        title: `${attr.key.replace(/_/g, " ")} ended`,
      });
    }
  }

  // Relations
  for (const rel of relations) {
    const otherId = rel.source_id === entity.id ? rel.target_id : rel.source_id;
    const info = entityNameMap.get(otherId);
    const otherName = info?.name ?? otherId.slice(0, 8) + "...";
    const direction = rel.source_id === entity.id ? "to" : "from";

    if (rel.valid_from) {
      events.push({
        id: `rel-start-${rel.id}`,
        date: rel.valid_from,
        kind: "relation_start",
        title: `${rel.type.replace(/_/g, " ")} ${direction} ${otherName}`,
        entityId: otherId,
        entityName: otherName,
      });
    }
    if (rel.valid_to) {
      events.push({
        id: `rel-end-${rel.id}`,
        date: rel.valid_to,
        kind: "relation_end",
        title: `${rel.type.replace(/_/g, " ")} ${direction} ${otherName} ended`,
        entityId: otherId,
        entityName: otherName,
      });
    }
  }

  // Intel
  for (const link of intelLinks) {
    const intel = intelRecords.get(link.intel_id);
    if (!intel) continue;
    const data = isRecord(intel.data) ? intel.data : undefined;
    const desc = typeof data?.description === "string" ? data.description : "";
    events.push({
      id: `intel-${intel.id}`,
      date: intel.occurred_at,
      kind: "intel",
      title: `${intel.type}: ${desc ? truncate(desc, 60) : "No description"}`,
      confidence: intel.confidence,
      sensitivity: intel.sensitivity,
    });
  }

  return (
    <div className="pt-4">
      <TimelineView events={events} emptyMessage="No timeline events for this entity." />
    </div>
  );
}

// --- About Field ---

function AboutField({
  entityId,
  attributes,
  onSave,
}: {
  entityId: string;
  attributes: Array<ReplicaRow<EntityAttribute>>;
  onSave: () => Promise<void>;
}) {
  const aboutAttr = attributes.find((a) => a.key === "about");
  const [value, setValue] = useState(aboutAttr?.value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(aboutAttr?.value ?? "");
  }, [aboutAttr?.value]);

  async function handleBlur() {
    const trimmed = value.trim();
    if (trimmed === (aboutAttr?.value ?? "")) return;
    setSaving(true);
    try {
      if (aboutAttr) {
        await updateRecord("entity_attributes", aboutAttr.id, { value: trimmed } as Partial<EntityAttribute>);
      } else if (trimmed) {
        await createRecord("entity_attributes", {
          entity_id: entityId,
          key: "about",
          value: trimmed,
          valid_from: null,
          valid_to: null,
          confidence: "medium",
          notes: null,
          source_id: null,
        });
      }
      await onSave();
    } catch (error) {
      console.error("Failed to save about:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <textarea
      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
      placeholder="Add a description about this entity..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={saving}
    />
  );
}

// --- Recent Activity ---

function RecentActivity({
  entityId,
  relations,
  intelLinks,
  intelRecords,
  entityNameMap,
}: {
  entityId: string;
  relations: Array<ReplicaRow<Relation>>;
  intelLinks: Array<ReplicaRow<IntelEntity>>;
  intelRecords: Map<string, ReplicaRow<Intel>>;
  entityNameMap: Map<string, { name: string; type: string }>;
}) {
  interface ActivityRow {
    id: string;
    date: string;
    type: "relation" | "intel";
    description: string;
    entityId?: string;
    entityName?: string;
  }

  const items: ActivityRow[] = [];

  for (const rel of relations.slice(0, 5)) {
    const otherId = rel.source_id === entityId ? rel.target_id : rel.source_id;
    const info = entityNameMap.get(otherId);
    const dir = rel.source_id === entityId ? "to" : "from";
    items.push({
      id: `rel-${rel.id}`,
      date: rel.created_at,
      type: "relation",
      description: `${rel.type.replace(/_/g, " ")} ${dir} ${info?.name ?? otherId.slice(0, 8)}`,
      entityId: otherId,
      entityName: info?.name,
    });
  }

  for (const link of intelLinks.slice(0, 5)) {
    const intel = intelRecords.get(link.intel_id);
    if (!intel) continue;
    const data = isRecord(intel.data) ? intel.data : undefined;
    const desc = typeof data?.description === "string" ? truncate(data.description, 50) : intel.type;
    items.push({
      id: `intel-${intel.id}`,
      date: intel.occurred_at,
      type: "intel",
      description: desc,
    });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const display = items.slice(0, 8);

  if (display.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <div className="space-y-2">
      {display.map((item) => (
        <div key={item.id} className="flex items-start gap-3 text-sm">
          <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
            {new Date(item.date).toLocaleDateString()}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${item.type === "relation" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
            {item.type === "relation" ? "rel" : "intel"}
          </span>
          <span className="truncate">
            {item.entityId ? (
              <EntityLink id={item.entityId} name={item.description} type={entityNameMap.get(item.entityId)?.type} />
            ) : (
              item.description
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
