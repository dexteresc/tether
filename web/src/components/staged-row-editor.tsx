import { observer } from "mobx-react-lite";
import { useState } from "react";
import type { StagedExtraction, TableName } from "@/lib/sync/types";
import { updateStagedExtraction } from "@/lib/idb/staged";
import {
  validateProposedRow,
  type ValidationError,
} from "@/services/validation/dbValidation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StagedRowEditorProps {
  staged: StagedExtraction;
  onStatusChange?: () => void;
}

const TABLE_LABELS: Record<TableName, string> = {
  entities: "Entity",
  identifiers: "Identifier",
  relations: "Relation",
  intel: "Intel",
  intel_entities: "Intel-Entity Link",
  sources: "Source",
};

export const StagedRowEditor = observer(function StagedRowEditor({
  staged,
  onStatusChange,
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

  const statusColors: Record<string, string> = {
    proposed: "bg-amber-500",
    accepted: "bg-emerald-600",
    edited: "bg-emerald-600",
    rejected: "bg-destructive",
  };

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <CardTitle className="text-sm">
              {TABLE_LABELS[staged.table] || staged.table}
            </CardTitle>
            <span
              className={`text-xs text-white px-2 py-0.5 rounded ${statusColors[staged.status] ?? "bg-muted"}`}
            >
              {staged.status}
            </span>
            {staged.origin_label && (
              <span className="text-xs text-muted-foreground">
                ({staged.origin_label})
              </span>
            )}
          </div>

          {!isEditing && (
            <div className="flex gap-2">
              {(staged.status === "proposed" ||
                staged.status === "edited") && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleAccept}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEdit}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                  >
                    Reject
                  </Button>
                </>
              )}
              {staged.status === "accepted" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleReject}
                >
                  Undo
                </Button>
              )}
              {staged.status === "rejected" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAccept}
                >
                  Undo
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div>
            <textarea
              value={editedRow}
              onChange={(e) => setEditedRow(e.target.value)}
              className="w-full min-h-[200px] font-mono text-xs p-2 border rounded-md bg-background"
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
            <div className="mt-3 flex gap-2">
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
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto m-0">
            {JSON.stringify(staged.proposed_row, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
});
