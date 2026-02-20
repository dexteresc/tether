import type { IDBPDatabase, IndexNames } from "idb";
import { getTetherDb, type TetherDbSchema } from "./db";

export async function getByKey<StoreName extends keyof TetherDbSchema>(
  storeName: StoreName,
  key: TetherDbSchema[StoreName]["key"]
): Promise<TetherDbSchema[StoreName]["value"] | undefined> {
  const db = await getTetherDb();
  return db.get(storeName as StoreName & string, key);
}

export async function putValue<StoreName extends keyof TetherDbSchema>(
  storeName: StoreName,
  value: TetherDbSchema[StoreName]["value"]
): Promise<TetherDbSchema[StoreName]["key"]> {
  const db = await getTetherDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.put(storeName as StoreName & string, value as any) as any;
}

export async function bulkPut<StoreName extends keyof TetherDbSchema>(
  storeName: StoreName,
  values: Array<TetherDbSchema[StoreName]["value"]>
): Promise<void> {
  const db = await getTetherDb();
  const tx = db.transaction(storeName as StoreName & string, "readwrite");
  for (const value of values) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx.store.put(value as any);
  }
  await tx.done;
}

export async function queryIndex<
  StoreName extends keyof TetherDbSchema,
  IndexName extends IndexNames<TetherDbSchema, StoreName>,
>(
  storeName: StoreName,
  indexName: IndexName,
  query: Parameters<IDBPDatabase<TetherDbSchema>["getAllFromIndex"]>[2],
  limit?: number
): Promise<Array<TetherDbSchema[StoreName]["value"]>> {
  const db = await getTetherDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.getAllFromIndex(
    storeName as StoreName & string,
    indexName as any,
    query,
    limit
  ) as any;
}

export interface PaginateOptions<
  StoreName extends keyof TetherDbSchema,
  IndexName extends IndexNames<TetherDbSchema, StoreName>,
> {
  storeName: StoreName;
  indexName: IndexName;
  direction?: IDBCursorDirection;
  limit: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  range?: any;
}

export async function paginate<
  StoreName extends keyof TetherDbSchema,
  IndexName extends IndexNames<TetherDbSchema, StoreName>,
>({
  storeName,
  indexName,
  direction = "next",
  limit,
  range,
}: PaginateOptions<StoreName, IndexName>): Promise<
  Array<TetherDbSchema[StoreName]["value"]>
> {
  const db = await getTetherDb();
  const tx = db.transaction(storeName as StoreName & string, "readonly");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const index = tx.store.index(indexName as any);
  const results: Array<TetherDbSchema[StoreName]["value"]> = [];

  let cursor = await index.openCursor(range, direction);
  while (cursor && results.length < limit) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results.push(cursor.value as any);
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
}
