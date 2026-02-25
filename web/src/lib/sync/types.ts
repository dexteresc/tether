import type { Database } from "@/types/database";

export type IsoDateTimeString = string;

export const TABLES = [
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

export type TableName = (typeof TABLES)[number];

export type RemoteRow<T extends TableName> =
  Database["public"]["Tables"][T]["Row"];

export interface ReplicaMeta {
  local_last_accessed_at: IsoDateTimeString;
  local_dirty: boolean;
  local_deleted: boolean;
  base_updated_at: IsoDateTimeString | null;
  last_pulled_at: IsoDateTimeString | null;
}

export type ReplicaRow<T extends { id: string }> = T & { __meta: ReplicaMeta };

export type OutboxOperation = "insert" | "update" | "delete";
export type OutboxStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "error"
  | "canceled";

export interface OutboxTransaction<T extends TableName = TableName> {
  tx_id: string;
  created_at: IsoDateTimeString;
  table: T;
  op: OutboxOperation;
  record_id: string;
  payload: Partial<RemoteRow<T>>;
  base_updated_at: IsoDateTimeString | null;
  status: OutboxStatus;
  attempt_count: number;
  last_error: string | null;
  next_retry_at: IsoDateTimeString | null;
  synced_at: IsoDateTimeString | null;
}

export type NlQueueStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export interface NlQueueItem {
  input_id: string;
  created_at: IsoDateTimeString;
  text: string;
  context: string | null;
  status: NlQueueStatus;
  position: number;
  estimated_seconds: number | null;
  result: unknown | null;
  error: string | null;
  updated_at: IsoDateTimeString;
}

export type StagedStatus = "proposed" | "accepted" | "rejected" | "edited" | "committed";

export interface StagedExtraction {
  staged_id: string;
  created_at: IsoDateTimeString;
  input_id: string;
  table: TableName;
  proposed_row: unknown;
  status: StagedStatus;
  validation_errors: unknown | null;
  origin_label: string | null;
}

export type ConflictReason =
  | "update_precondition_failed"
  | "deleted_on_server"
  | "other";
export type ConflictStatus =
  | "pending_review"
  | "manually_resolved"
  | "dismissed";

export interface ConflictEntry {
  conflict_id: string;
  created_at: IsoDateTimeString;
  table: TableName;
  record_id: string;
  server_row: unknown;
  local_row: unknown;
  reason: ConflictReason;
  status: ConflictStatus;
  note: string | null;
}

export interface SyncStateEntry {
  key: string;
  value: unknown;
  updated_at: IsoDateTimeString;
}

export type SyncLogOperation = "INSERT" | "UPDATE" | "DELETE";

export interface SyncLogEntry {
  seq: number;
  table_name: TableName;
  record_id: string;
  operation: SyncLogOperation;
  row_data: Record<string, unknown> | null;
  created_at: string;
}

export interface SyncLogBatch {
  entries: SyncLogEntry[];
  last_seq: number;
  has_more: boolean;
}
