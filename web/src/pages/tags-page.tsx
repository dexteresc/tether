import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { useRootStore } from "@/hooks/use-root-store";
import { DataTable, type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { createRecord } from "@/services/sync/createRecord";
import { TAG_CATEGORIES } from "@/lib/constants";
import { capitalize, selectClass } from "@/lib/utils";
import { Tag, Plus } from "lucide-react";
import type { RemoteRow, ReplicaRow } from "@/lib/sync/types";

type Tag = RemoteRow<"tags">;

export const TagsPage = observer(function TagsPage() {
  const { replica, outbox } = useRootStore();
  const [tags, setTags] = useState<Array<ReplicaRow<Tag>>>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("topic");
  const [color, setColor] = useState("#6366f1");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await replica.listByUpdatedAt("tags", 1000);
      setTags(data.filter((t) => !t.deleted_at));
    } catch (error) {
      console.error("Failed to load tags:", error);
    } finally {
      setLoading(false);
    }
  }, [replica]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setName("");
    setCategory("topic");
    setColor("#6366f1");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await createRecord("tags", {
        name: name.trim(),
        category,
        color,
      });
      await outbox.refresh();
      await load();
      resetForm();
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to create tag:", error);
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<Column<ReplicaRow<Tag>>> = [
    {
      key: "color",
      label: "",
      width: "40px",
      render: (row) => (
        <div
          className="w-4 h-4 rounded-full border"
          style={{ backgroundColor: row.color || "#888" }}
        />
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "category",
      label: "Category",
      width: "140px",
      render: (row) => <span className="capitalize">{row.category}</span>,
    },
    {
      key: "created_at",
      label: "Created",
      width: "180px",
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ];

  if (!loading && tags.length === 0) {
    return (
      <div>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">Tags</h2>
          <Button size="sm" onClick={() => setSheetOpen(true)}>Add Tag</Button>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <Tag className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No tags yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Tags help you categorize and organize entities and intel. Create your first tag to get started.
          </p>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Tag
          </Button>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add Tag</SheetTitle>
              <SheetDescription>Create a new tag.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tagName">Name</Label>
                <Input id="tagName" placeholder="e.g. Operation Sunrise" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tagCategory">Category</Label>
                <select id="tagCategory" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {TAG_CATEGORIES.map((c) => (<option key={c} value={c}>{capitalize(c)}</option>))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tagColor">Color</Label>
                <div className="flex items-center gap-2">
                  <Input id="tagColor" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-9 p-1" />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" className="flex-1" />
                </div>
              </div>
              <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Creating..." : "Create Tag"}</Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold">Tags</h2>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          Add Tag
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={tags}
        loading={loading}
        emptyMessage="No tags found."
        searchable
        searchPlaceholder="Search tags..."
        searchFn={(row, q) => row.name.toLowerCase().includes(q)}
        filters={[
          {
            key: "category",
            label: "All Categories",
            options: TAG_CATEGORIES.map((c) => ({
              value: c,
              label: capitalize(c),
            })),
          },
        ]}
        filterFn={(row, filters) => {
          if (filters.category && row.category !== filters.category) return false;
          return true;
        }}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Tag</SheetTitle>
            <SheetDescription>Create a new tag.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tagName">Name</Label>
              <Input
                id="tagName"
                placeholder="e.g. Operation Sunrise"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tagCategory">Category</Label>
              <select
                id="tagCategory"
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {TAG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {capitalize(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tagColor">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tagColor"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-9 p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1"
                />
              </div>
            </div>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating..." : "Create Tag"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
});
