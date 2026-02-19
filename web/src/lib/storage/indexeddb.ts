import type { Entity, Intel } from "@/types/models";

const DB_NAME = "tether";
const DB_VERSION = 1;

const STORES = {
  entities: "entities",
  intel: "intel",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.entities)) {
        const entityStore = db.createObjectStore(STORES.entities, {
          keyPath: "id",
        });
        entityStore.createIndex("type", "type", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.intel)) {
        const intelStore = db.createObjectStore(STORES.intel, {
          keyPath: "id",
        });
        intelStore.createIndex("type", "type", { unique: false });
        intelStore.createIndex("classification", "classification", {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withTransaction<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

export const entityStore = {
  async getAll(): Promise<Entity[]> {
    return withTransaction(STORES.entities, "readonly", (store) =>
      store.getAll()
    );
  },

  async getById(id: string): Promise<Entity | undefined> {
    return withTransaction(STORES.entities, "readonly", (store) =>
      store.get(id)
    );
  },

  async getByType(type: Entity["type"]): Promise<Entity[]> {
    return withTransaction(STORES.entities, "readonly", (store) =>
      store.index("type").getAll(type)
    );
  },

  async put(entity: Entity): Promise<string> {
    return withTransaction(STORES.entities, "readwrite", (store) =>
      store.put(entity)
    ) as Promise<string>;
  },

  async putMany(entities: Entity[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.entities, "readwrite");
      const store = tx.objectStore(STORES.entities);

      for (const entity of entities) {
        store.put(entity);
      }

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  },

  async delete(id: string): Promise<void> {
    return withTransaction(STORES.entities, "readwrite", (store) =>
      store.delete(id)
    ) as Promise<void>;
  },

  async clear(): Promise<void> {
    return withTransaction(STORES.entities, "readwrite", (store) =>
      store.clear()
    ) as Promise<void>;
  },
};

export const intelStore = {
  async getAll(): Promise<Intel[]> {
    return withTransaction(STORES.intel, "readonly", (store) => store.getAll());
  },

  async getById(id: string): Promise<Intel | undefined> {
    return withTransaction(STORES.intel, "readonly", (store) => store.get(id));
  },

  async getByType(type: Intel["type"]): Promise<Intel[]> {
    return withTransaction(STORES.intel, "readonly", (store) =>
      store.index("type").getAll(type)
    );
  },

  async getByClassification(
    classification: Intel["classification"]
  ): Promise<Intel[]> {
    return withTransaction(STORES.intel, "readonly", (store) =>
      store.index("classification").getAll(classification)
    );
  },

  async put(intel: Intel): Promise<string> {
    return withTransaction(STORES.intel, "readwrite", (store) =>
      store.put(intel)
    ) as Promise<string>;
  },

  async putMany(items: Intel[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.intel, "readwrite");
      const store = tx.objectStore(STORES.intel);

      for (const item of items) {
        store.put(item);
      }

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  },

  async delete(id: string): Promise<void> {
    return withTransaction(STORES.intel, "readwrite", (store) =>
      store.delete(id)
    ) as Promise<void>;
  },

  async clear(): Promise<void> {
    return withTransaction(STORES.intel, "readwrite", (store) =>
      store.clear()
    ) as Promise<void>;
  },
};

export async function clearAllStores(): Promise<void> {
  await entityStore.clear();
  await intelStore.clear();
}

export async function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
