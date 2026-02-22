import { observer } from "mobx-react-lite";
import { useState } from "react";
import type { StagedExtraction, TableName } from "@/lib/sync/types";
import { updateStagedExtraction } from "@/lib/idb/staged";
import {
  validateProposedRow,
  type ValidationError,
} from "@/services/validation/dbValidation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type IdLabel = { label: string; type?: string };

interface StagedRowEditorProps {
  staged: StagedExtraction;
  onStatusChange?: () => void;
  idLabels?: Map<string, IdLabel>;
}

const TABLE_LABELS: Record<TableName, string> = {
  entities: "Entity",
  identifiers: "Identifier",
  relations: "Relation",
  intel: "Intel",
  intel_entities: "Intel-Entity Link",
  sources: "Source",
  entity_attributes: "Attribute",
  tags: "Tag",
  record_tags: "Record Tag",
};

const TABLE_ICONS: Record<TableName, string> = {
  entities: "U",
  identifiers: "ID",
  relations: "R",
  intel: "I",
  intel_entities: "IE",
  sources: "S",
  entity_attributes: "EA",
  tags: "T",
  record_tags: "RT",
};

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}

function IdRef({
  id,
  idLabels,
}: {
  id: string;
  idLabels?: Map<string, IdLabel>;
}) {
  const info = idLabels?.get(id);
  if (info) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-medium">{info.label}</span>
        {info.type && (
          <span className="text-[10px] px-1 py-0.5 bg-muted rounded capitalize text-muted-foreground">
            {info.type}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {id.slice(0, 8)}...
    </span>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    confirmed: "bg-emerald-100 text-emerald-800",
    high: "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-orange-50 text-orange-700",
    unconfirmed: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded capitalize ${colors[level] ?? "bg-muted"}`}
    >
      {level}
    </span>
  );
}

function ProposedRowDisplay({
  table,
  row,
  idLabels,
}: {
  table: TableName;
  row: Record<string, unknown>;
  idLabels?: Map<string, IdLabel>;
}) {
  const data = row.data as Record<string, unknown> | undefined;

  switch (table) {
    case "entities":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Name"
            value={
              <span className="font-medium">
                {(data?.name as string) ?? "—"}
              </span>
            }
          />
          <FieldRow
            label="Type"
            value={
              <span className="capitalize">{row.type as string}</span>
            }
          />
          {typeof data?.confidence === "string" && (
            <FieldRow
              label="Confidence"
              value={
                <ConfidenceBadge level={data.confidence} />
              }
            />
          )}
        </div>
      );

    case "identifiers":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Type"
            value={
              <span className="capitalize">{row.type as string}</span>
            }
          />
          <FieldRow
            label="Value"
            value={
              <span className="font-medium">{row.value as string}</span>
            }
          />
          <FieldRow
            label="Entity"
            value={<IdRef id={row.entity_id as string} idLabels={idLabels} />}
          />
        </div>
      );

    case "intel":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Type"
            value={
              <span className="capitalize">{row.type as string}</span>
            }
          />
          {typeof data?.description === "string" && (
            <FieldRow
              label="Description"
              value={data.description}
            />
          )}
          {typeof row.occurred_at === "string" && (
            <FieldRow
              label="Occurred"
              value={new Date(row.occurred_at).toLocaleString()}
            />
          )}
          {typeof row.confidence === "string" && (
            <FieldRow
              label="Confidence"
              value={
                <ConfidenceBadge level={row.confidence} />
              }
            />
          )}
        </div>
      );

    case "relations":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Type"
            value={
              <span className="capitalize">{row.type as string}</span>
            }
          />
          <FieldRow
            label="Source"
            value={<IdRef id={row.source_id as string} idLabels={idLabels} />}
          />
          <FieldRow
            label="Target"
            value={<IdRef id={row.target_id as string} idLabels={idLabels} />}
          />
          {typeof data?.description === "string" && (
            <FieldRow
              label="Description"
              value={data.description}
            />
          )}
        </div>
      );

    case "intel_entities":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Intel"
            value={<IdRef id={row.intel_id as string} idLabels={idLabels} />}
          />
          <FieldRow
            label="Entity"
            value={<IdRef id={row.entity_id as string} idLabels={idLabels} />}
          />
          {typeof row.role === "string" && (
            <FieldRow label="Role" value={row.role} />
          )}
        </div>
      );

    case "entity_attributes":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Entity"
            value={<IdRef id={row.entity_id as string} idLabels={idLabels} />}
          />
          <FieldRow
            label="Key"
            value={<span className="font-medium">{row.key as string}</span>}
          />
          <FieldRow
            label="Value"
            value={<span className="font-medium">{row.value as string}</span>}
          />
          {typeof row.confidence === "string" && (
            <FieldRow
              label="Confidence"
              value={<ConfidenceBadge level={row.confidence} />}
            />
          )}
        </div>
      );

    case "tags":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Name"
            value={<span className="font-medium">{row.name as string}</span>}
          />
          {typeof row.category === "string" && (
            <FieldRow
              label="Category"
              value={<span className="capitalize">{row.category}</span>}
            />
          )}
        </div>
      );

    case "record_tags":
      return (
        <div className="flex flex-col gap-1">
          <FieldRow
            label="Tag"
            value={<IdRef id={row.tag_id as string} idLabels={idLabels} />}
          />
          <FieldRow
            label="Record"
            value={<IdRef id={row.record_id as string} idLabels={idLabels} />}
          />
          {typeof row.record_table === "string" && (
            <FieldRow label="Table" value={row.record_table} />
          )}
        </div>
      );

    default:
      return (
        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto m-0">
          {JSON.stringify(row, null, 2)}
        </pre>
      );
  }
}

export const StagedRowEditor = observer(function StagedRowEditor({
  staged,
  onStatusChange,
  idLabels,
}: StagedRowEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRow, setEditedRow] = useState<string>(
    JSON.stringify(staged.proposed_row, null, 2)
  );
  const [validationErrors, setValidationErrors] = useState<
    ValidationError[]
  >([]);

  const handleAccept = async () => {
    await updateStagedExtraction(staged.staged_id, {
      status: "accepted",
      validation_errors: null,
    });
    onStatusChange?.();
  };

  const handleReject = async () => {
    await updateStagedExtraction(staged.staged_id, {
      status: "rejected",
      validation_errors: null,
    });
    onStatusChange?.();
  };

  const handleEdit = () => {
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleSaveEdit = async () => {
    try {
      const parsedRow = JSON.parse(editedRow);
      const errors = validateProposedRow(staged.table, parsedRow);

      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      await updateStagedExtraction(staged.staged_id, {
        proposed_row: parsedRow,
        status: "edited",
        validation_errors: null,
      });

      setIsEditing(false);
      setValidationErrors([]);
      onStatusChange?.();
    } catch {
      setValidationErrors([
        { field: "_root", message: "Invalid JSON format" },
      ]);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedRow(JSON.stringify(staged.proposed_row, null, 2));
    setValidationErrors([]);
  };

  const statusStyles: Record<string, string> = {
    proposed: "border-l-amber-500",
    accepted: "border-l-emerald-600",
    edited: "border-l-blue-500",
    rejected: "border-l-destructive opacity-60",
    committed: "border-l-emerald-600 opacity-75",
  };

  const statusBadgeStyles: Record<string, string> = {
    proposed: "bg-amber-100 text-amber-800",
    accepted: "bg-emerald-100 text-emerald-800",
    edited: "bg-blue-100 text-blue-800",
    rejected: "bg-red-100 text-red-800",
    committed: "bg-emerald-100 text-emerald-800",
  };

  const row = staged.proposed_row as Record<string, unknown>;

  return (
    <Card
      className={`mb-2 border-l-4 ${statusStyles[staged.status] ?? ""}`}
    >
      <CardContent className="py-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5 uppercase tracking-wide">
                {TABLE_ICONS[staged.table]}
              </span>
              <span className="text-sm font-medium">
                {TABLE_LABELS[staged.table] || staged.table}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${statusBadgeStyles[staged.status] ?? "bg-muted"}`}
              >
                {staged.status}
              </span>
              {staged.origin_label && (
                <span className="text-xs text-muted-foreground">
                  {staged.origin_label}
                </span>
              )}
            </div>

            {isEditing ? (
              <div>
                <textarea
                  value={editedRow}
                  onChange={(e) => setEditedRow(e.target.value)}
                  className="w-full min-h-[160px] font-mono text-xs p-2 border rounded-md bg-background"
                />
                {validationErrors.length > 0 && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded-md">
                    <strong className="text-destructive text-xs font-bold">
                      Validation errors:
                    </strong>
                    <ul className="m-0 mt-1 pl-5 text-xs text-destructive">
                      {validationErrors.map((err, idx) => (
                        <li key={idx}>
                          {err.field !== "_root" && (
                            <strong>{err.field}:</strong>
                          )}{" "}
                          {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <ProposedRowDisplay table={staged.table} row={row} idLabels={idLabels} />
            )}
          </div>

          {!isEditing && (
            <div className="flex gap-1.5 shrink-0">
              {(staged.status === "proposed" ||
                staged.status === "edited") && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={handleAccept}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleEdit}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleReject}
                  >
                    Reject
                  </Button>
                </>
              )}
              {staged.status === "accepted" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={handleReject}
                >
                  Undo
                </Button>
              )}
              {staged.status === "rejected" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={handleAccept}
                >
                  Undo
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
