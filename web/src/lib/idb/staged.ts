import { getTetherDb } from "./db";
import { STAGED_INDEXES } from "./schema";
import type {
  StagedExtraction,
  StagedStatus,
  TableName,
} from "@/lib/sync/types";

export async function createStagedExtraction(
  inputId: string,
  table: TableName,
  proposedRow: unknown,
  originLabel?: string | null
): Promise<StagedExtraction> {
  const db = await getTetherDb();
  const now = new Date().toISOString();

  const staged: StagedExtraction = {
    staged_id: crypto.randomUUID(),
    created_at: now,
    input_id: inputId,
    table,
    proposed_row: proposedRow,
    status: "proposed",
    validation_errors: null,
    origin_label: originLabel ?? null,
  };

  await db.put("staged_extractions", staged);
  return staged;
}

export async function getStagedExtractionsByInputId(
  inputId: string
): Promise<StagedExtraction[]> {
  const db = await getTetherDb();
  return db.getAllFromIndex(
    "staged_extractions",
    STAGED_INDEXES.byInputId,
    inputId
  );
}

export async function getStagedExtractionsByStatus(
  status: StagedStatus
): Promise<StagedExtraction[]> {
  const db = await getTetherDb();
  return db.getAllFromIndex(
    "staged_extractions",
    STAGED_INDEXES.byStatus,
    status
  );
}

export async function updateStagedExtraction(
  stagedId: string,
  updates: Partial<
    Pick<StagedExtraction, "status" | "proposed_row" | "validation_errors">
  >
): Promise<void> {
  const db = await getTetherDb();
  const existing = await db.get("staged_extractions", stagedId);
  if (!existing) {
    throw new Error(`Staged extraction ${stagedId} not found`);
  }

  await db.put("staged_extractions", {
    ...existing,
    ...updates,
  });
}

export async function deleteStagedExtractionsByInputId(
  inputId: string
): Promise<void> {
  const db = await getTetherDb();
  const stagedItems = await getStagedExtractionsByInputId(inputId);
  const tx = db.transaction("staged_extractions", "readwrite");
  await Promise.all(
    stagedItems.map((item) => tx.store.delete(item.staged_id))
  );
  await tx.done;
}

export async function getAcceptedStagedExtractions(): Promise<
  StagedExtraction[]
> {
  return getStagedExtractionsByStatus("accepted");
}
