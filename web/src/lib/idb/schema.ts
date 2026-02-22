export const REPLICA_TABLES = [
  "sources",
  "entities",
  "identifiers",
  "relations",
  "intel",
  "intel_entities",
  "entity_attributes",
  "tags",
  "record_tags",
] as const;

export type ReplicaTableName = (typeof REPLICA_TABLES)[number];

export const LOCAL_STORES = [
  "outbox_transactions",
  "nl_input_queue",
  "staged_extractions",
  "conflict_log",
  "sync_state",
] as const;

export type LocalStoreName = (typeof LOCAL_STORES)[number];

export type StoreName = ReplicaTableName | LocalStoreName;

export const DB_NAME = "tether";
export const DB_VERSION = 2;

export const REPLICA_INDEXES = {
  byUpdatedAt: "by_updated_at",
  byDeletedAt: "by_deleted_at",
  byLocalDirty: "by_local_dirty",
  byLocalLastAccessedAt: "by_local_last_accessed_at",
} as const;

export const OUTBOX_INDEXES = {
  byStatus: "by_status",
  byCreatedAt: "by_created_at",
  byNextRetryAt: "by_next_retry_at",
  byTableRecord: "by_table_record",
} as const;

export const NL_QUEUE_INDEXES = {
  byStatus: "by_status",
  byCreatedAt: "by_created_at",
} as const;

export const STAGED_INDEXES = {
  byInputId: "by_input_id",
  byStatus: "by_status",
} as const;

export const CONFLICT_INDEXES = {
  byStatus: "by_status",
  byTableRecord: "by_table_record",
} as const;
