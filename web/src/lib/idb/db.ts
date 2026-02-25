import { openDB, type IDBPDatabase } from "idb";
import type { Database } from "@/types/database";
import type {
  ConflictEntry,
  NlQueueItem,
  OutboxTransaction,
  ReplicaRow,
  StagedExtraction,
  SyncStateEntry,
} from "@/lib/sync/types";
import {
  CONFLICT_INDEXES,
  DB_NAME,
  DB_VERSION,
  NL_QUEUE_INDEXES,
  OUTBOX_INDEXES,
  REPLICA_INDEXES,
  REPLICA_TABLES,
  STAGED_INDEXES,
} from "./schema";

export interface TetherDbSchema {
  sources: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["sources"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  entities: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["entities"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  identifiers: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["identifiers"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  relations: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["relations"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  intel: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["intel"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  intel_entities: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["intel_entities"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  entity_attributes: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["entity_attributes"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  tags: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["tags"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };
  record_tags: {
    key: string;
    value: ReplicaRow<Database["public"]["Tables"]["record_tags"]["Row"]>;
    indexes: {
      by_updated_at: string;
      by_deleted_at: string;
      by_local_dirty: boolean;
      by_local_last_accessed_at: string;
    };
  };

  outbox_transactions: {
    key: string;
    value: OutboxTransaction;
    indexes: {
      by_status: string;
      by_created_at: string;
      by_next_retry_at: string | null;
      by_table_record: [string, string];
    };
  };
  nl_input_queue: {
    key: string;
    value: NlQueueItem;
    indexes: {
      by_status: string;
      by_created_at: string;
    };
  };
  staged_extractions: {
    key: string;
    value: StagedExtraction;
    indexes: {
      by_input_id: string;
      by_status: string;
    };
  };
  conflict_log: {
    key: string;
    value: ConflictEntry;
    indexes: {
      by_status: string;
      by_table_record: [string, string];
    };
  };
  sync_state: {
    key: string;
    value: SyncStateEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<TetherDbSchema>> | null = null;

export function openTetherDb(): Promise<IDBPDatabase<TetherDbSchema>> {
  return openDB<TetherDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      for (const table of REPLICA_TABLES) {
        if (!db.objectStoreNames.contains(table)) {
          const store = db.createObjectStore(table, { keyPath: "id" });
          store.createIndex(REPLICA_INDEXES.byUpdatedAt, "updated_at");
          store.createIndex(REPLICA_INDEXES.byDeletedAt, "deleted_at");
          store.createIndex(
            REPLICA_INDEXES.byLocalDirty,
            "__meta.local_dirty"
          );
          store.createIndex(
            REPLICA_INDEXES.byLocalLastAccessedAt,
            "__meta.local_last_accessed_at"
          );
        }
      }

      if (!db.objectStoreNames.contains("outbox_transactions")) {
        const store = db.createObjectStore("outbox_transactions", {
          keyPath: "tx_id",
        });
        store.createIndex(OUTBOX_INDEXES.byStatus, "status");
        store.createIndex(OUTBOX_INDEXES.byCreatedAt, "created_at");
        store.createIndex(OUTBOX_INDEXES.byNextRetryAt, "next_retry_at");
        store.createIndex(OUTBOX_INDEXES.byTableRecord, [
          "table",
          "record_id",
        ]);
      }

      if (!db.objectStoreNames.contains("nl_input_queue")) {
        const store = db.createObjectStore("nl_input_queue", {
          keyPath: "input_id",
        });
        store.createIndex(NL_QUEUE_INDEXES.byStatus, "status");
        store.createIndex(NL_QUEUE_INDEXES.byCreatedAt, "created_at");
      }

      if (!db.objectStoreNames.contains("staged_extractions")) {
        const store = db.createObjectStore("staged_extractions", {
          keyPath: "staged_id",
        });
        store.createIndex(STAGED_INDEXES.byInputId, "input_id");
        store.createIndex(STAGED_INDEXES.byStatus, "status");
      }

      if (!db.objectStoreNames.contains("conflict_log")) {
        const store = db.createObjectStore("conflict_log", {
          keyPath: "conflict_id",
        });
        store.createIndex(CONFLICT_INDEXES.byStatus, "status");
        store.createIndex(CONFLICT_INDEXES.byTableRecord, [
          "table",
          "record_id",
        ]);
      }

      if (!db.objectStoreNames.contains("sync_state")) {
        db.createObjectStore("sync_state", { keyPath: "key" });
      }
    },
  });
}

export function getTetherDb(): Promise<IDBPDatabase<TetherDbSchema>> {
  dbPromise ??= openTetherDb();
  return dbPromise;
}

