import type { StoreNames, IndexNames, StoreValue, StoreKey } from "idb";
import { getTetherDb, type TetherDbSchema } from "./db";

type DbStore = StoreNames<TetherDbSchema>;

export async function getByKey<S extends DbStore>(
  storeName: S,
  key: StoreKey<TetherDbSchema, S>
): Promise<StoreValue<TetherDbSchema, S> | undefined> {
  const db = await getTetherDb();
  return db.get(storeName, key);
}

export async function putValue<S extends DbStore>(
  storeName: S,
  value: StoreValue<TetherDbSchema, S>
): Promise<StoreKey<TetherDbSchema, S>> {
  const db = await getTetherDb();
  return db.put(storeName, value);
}

export async function bulkPut<S extends DbStore>(
  storeName: S,
  values: Array<StoreValue<TetherDbSchema, S>>
): Promise<void> {
  const db = await getTetherDb();
  const tx = db.transaction(storeName, "readwrite");
  for (const value of values) {
    tx.store.put(value);
  }
  await tx.done;
}

export async function queryIndex<
  S extends DbStore,
  I extends IndexNames<TetherDbSchema, S>,
>(
  storeName: S,
  indexName: I,
  query?: IDBKeyRange,
  limit?: number
): Promise<Array<StoreValue<TetherDbSchema, S>>> {
  const db = await getTetherDb();
  return db.getAllFromIndex(storeName, indexName, query, limit);
}

export interface PaginateOptions<
  S extends DbStore,
  I extends IndexNames<TetherDbSchema, S>,
> {
  storeName: S;
  indexName: I;
  direction?: IDBCursorDirection;
  limit: number;
  range?: IDBKeyRange;
}

export async function paginate<
  S extends DbStore,
  I extends IndexNames<TetherDbSchema, S>,
>({
  storeName,
  indexName,
  direction = "next",
  limit,
  range,
}: PaginateOptions<S, I>): Promise<Array<StoreValue<TetherDbSchema, S>>> {
  const db = await getTetherDb();
  const tx = db.transaction(storeName, "readonly");
  const index = tx.store.index(indexName);
  const results: Array<StoreValue<TetherDbSchema, S>> = [];

  let cursor = await index.openCursor(range, direction);
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
}
