import { useCallback, useEffect, useState } from "react";
import { useRootStore } from "@/hooks/use-root-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRecord } from "@/services/sync/createRecord";
import { softDeleteRecord } from "@/services/sync/deleteRecord";
import { TAG_CATEGORIES } from "@/lib/constants";
import { capitalize, selectClass } from "@/lib/utils";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Tag = RemoteRow<"tags">;
type RecordTag = RemoteRow<"record_tags">;

export function TagAssigner({
  recordId,
  recordTable,
}: {
  recordId: string;
  recordTable: string;
}) {
  const { replica, outbox } = useRootStore();
  const [allTags, setAllTags] = useState<Array<ReplicaRow<Tag>>>([]);
  const [recordTags, setRecordTags] = useState<Array<ReplicaRow<RecordTag>>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("topic");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [tags, rts] = await Promise.all([
      replica.listByUpdatedAt("tags", 1000),
      replica.listByUpdatedAt("record_tags", 10000),
    ]);
    setAllTags(tags.filter((t) => !t.deleted_at));
    setRecordTags(
      rts.filter(
        (rt) =>
          rt.record_id === recordId &&
          rt.record_table === recordTable &&
          !rt.deleted_at
      )
    );
  }, [recordId, recordTable, replica]);

  useEffect(() => {
    load();
  }, [load]);

  const tagMap = new Map<string, ReplicaRow<Tag>>();
  for (const t of allTags) tagMap.set(t.id, t);

  const assignedTagIds = new Set(recordTags.map((rt) => rt.tag_id));
  const available = allTags
    .filter((t) => !assignedTagIds.has(t.id))
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  async function handleAssign(tagId: string) {
    setSaving(true);
    try {
      await createRecord("record_tags", {
        record_id: recordId,
        record_table: recordTable,
        tag_id: tagId,
      });
      await outbox.refresh();
      await load();
    } catch (error) {
      console.error("Failed to assign tag:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(recordTagId: string) {
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

  async function handleCreateAndAssign() {
    if (!newTagName.trim()) return;
    setSaving(true);
    try {
      const tagId = await createRecord("tags", {
        name: newTagName.trim(),
        category: newTagCategory,
        color: "#6366f1",
      });
      await createRecord("record_tags", {
        record_id: recordId,
        record_table: recordTable,
        tag_id: tagId,
      });
      await outbox.refresh();
      await load();
      setNewTagName("");
      setShowAdd(false);
    } catch (error) {
      console.error("Failed to create tag:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Current tags */}
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
                onClick={() => handleRemove(rt.id)}
                className="ml-1 hover:opacity-70"
                disabled={saving}
              >
                &times;
              </button>
            </span>
          );
        })}
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          + Add Tag
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-3 space-y-2">
          <Input
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-32 overflow-y-auto space-y-1">
            {available.map((tag) => (
              <button
                key={tag.id}
                className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded flex items-center gap-2"
                onClick={() => handleAssign(tag.id)}
                disabled={saving}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color || "#888" }}
                />
                {tag.name}
              </button>
            ))}
          </div>
          <div className="border-t pt-2 flex gap-2">
            <Input
              placeholder="New tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1"
            />
            <select
              className={selectClass + " w-auto"}
              value={newTagCategory}
              onChange={(e) => setNewTagCategory(e.target.value)}
            >
              {TAG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {capitalize(c)}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleCreateAndAssign} disabled={saving || !newTagName.trim()}>
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
