import type { IDBPDatabase } from "idb";
import type { ReplicaTableName } from "./schema";
import type { TetherDbSchema } from "./db";

export interface StorageEstimate {
  quota: number | null;
  usage: number | null;
  usageRatio: number | null;
}

export async function getStorageEstimate(): Promise<StorageEstimate> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { quota: null, usage: null, usageRatio: null };
  }

  const { quota, usage } = await navigator.storage.estimate();
  const safeQuota = typeof quota === "number" ? quota : null;
  const safeUsage = typeof usage === "number" ? usage : null;

  return {
    quota: safeQuota,
    usage: safeUsage,
    usageRatio: safeQuota && safeUsage ? safeUsage / safeQuota : null,
  };
}

export async function selectLruEvictionCandidates(
  db: IDBPDatabase<TetherDbSchema>,
  table: ReplicaTableName,
  maxCandidates: number
): Promise<string[]> {
  const tx = db.transaction(table, "readonly");
  const index = tx.store.index("by_local_last_accessed_at");

  const candidates: string[] = [];
  let cursor = await index.openCursor();

  while (cursor && candidates.length < maxCandidates) {
    const row = cursor.value;
    if (
      !row.__meta.local_dirty &&
      !row.__meta.local_deleted &&
      row.deleted_at == null
    ) {
      candidates.push(row.id);
    }
    cursor = await cursor.continue();
  }

  await tx.done;
  return candidates;
}
