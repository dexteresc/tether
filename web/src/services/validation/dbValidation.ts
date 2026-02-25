import type { Database } from "@/types/database";
import type { TableName } from "@/lib/sync/types";
import {
  ENTITY_TYPES,
  ENTITY_STATUSES,
  IDENTIFIER_TYPES,
  RELATION_TYPES,
  INTEL_TYPES,
  CONFIDENCE_LEVELS,
  SENSITIVITY_LEVELS,
  RELIABILITY_LEVELS,
  TAG_CATEGORIES,
} from "@/lib/constants";

export interface ValidationError {
  field: string;
  message: string;
}

function requireField(
  field: string,
  value: string | null | undefined,
  label: string
): ValidationError | null {
  if (!value || value.trim() === "") {
    return { field, message: `${label} is required` };
  }
  return null;
}

function requireEnum(
  field: string,
  value: string | null | undefined,
  allowed: readonly string[],
  label: string,
  required: boolean
): ValidationError | null {
  if (!value) {
    return required ? { field, message: `${label} is required` } : null;
  }
  if (!allowed.includes(value)) {
    return {
      field,
      message: `Invalid ${label.toLowerCase()}. Must be one of: ${allowed.join(", ")}`,
    };
  }
  return null;
}

function collectErrors(...results: (ValidationError | null)[]): ValidationError[] {
  return results.filter((e): e is ValidationError => e !== null);
}

type EntityInsert = Database["public"]["Tables"]["entities"]["Insert"];
type IdentifierInsert =
  Database["public"]["Tables"]["identifiers"]["Insert"];
type RelationInsert = Database["public"]["Tables"]["relations"]["Insert"];
type IntelInsert = Database["public"]["Tables"]["intel"]["Insert"];
type IntelEntityInsert =
  Database["public"]["Tables"]["intel_entities"]["Insert"];
type SourceInsert = Database["public"]["Tables"]["sources"]["Insert"];
type EntityAttributeInsert =
  Database["public"]["Tables"]["entity_attributes"]["Insert"];
type TagInsert = Database["public"]["Tables"]["tags"]["Insert"];
type RecordTagInsert =
  Database["public"]["Tables"]["record_tags"]["Insert"];

function validateEntity(row: EntityInsert): ValidationError[] {
  return collectErrors(
    requireEnum("type", row.type, ENTITY_TYPES, "Entity type", true),
    requireEnum("status", row.status, ENTITY_STATUSES, "Status", false),
    requireEnum("sensitivity", row.sensitivity, SENSITIVITY_LEVELS, "Sensitivity", false),
  );
}

function validateIdentifier(row: IdentifierInsert): ValidationError[] {
  return collectErrors(
    requireField("entity_id", row.entity_id, "Entity ID"),
    requireEnum("type", row.type, IDENTIFIER_TYPES, "Identifier type", true),
    requireField("value", row.value, "Identifier value"),
  );
}

function validateRelation(row: RelationInsert): ValidationError[] {
  const errors = collectErrors(
    requireField("source_id", row.source_id, "Source entity ID"),
    requireField("target_id", row.target_id, "Target entity ID"),
    requireEnum("type", row.type, RELATION_TYPES, "Relation type", true),
    requireEnum("sensitivity", row.sensitivity, SENSITIVITY_LEVELS, "Sensitivity", false),
  );

  if (
    row.strength !== null &&
    row.strength !== undefined &&
    (typeof row.strength !== "number" || row.strength < 1 || row.strength > 10)
  ) {
    errors.push({
      field: "strength",
      message: "Strength must be a number between 1 and 10",
    });
  }

  return errors;
}

function validateIntel(row: IntelInsert): ValidationError[] {
  const errors = collectErrors(
    requireEnum("type", row.type, INTEL_TYPES, "Intel type", true),
    requireEnum("confidence", row.confidence, CONFIDENCE_LEVELS, "Confidence level", false),
    requireEnum("sensitivity", row.sensitivity, SENSITIVITY_LEVELS, "Sensitivity", false),
  );

  if (!row.occurred_at) {
    errors.push({ field: "occurred_at", message: "Occurred at date is required" });
  } else if (isNaN(new Date(row.occurred_at).getTime())) {
    errors.push({ field: "occurred_at", message: "Invalid date format. Must be ISO 8601 string" });
  }

  return errors;
}

function validateIntelEntity(row: IntelEntityInsert): ValidationError[] {
  return collectErrors(
    requireField("intel_id", row.intel_id, "Intel ID"),
    requireField("entity_id", row.entity_id, "Entity ID"),
  );
}

function validateSource(row: SourceInsert): ValidationError[] {
  return collectErrors(
    requireField("code", row.code, "Source code"),
    requireField("type", row.type, "Source type"),
    requireEnum("reliability", row.reliability, RELIABILITY_LEVELS, "Reliability", true),
  );
}

function validateEntityAttribute(row: EntityAttributeInsert): ValidationError[] {
  return collectErrors(
    requireField("entity_id", row.entity_id, "Entity ID"),
    requireField("key", row.key, "Attribute key"),
    requireField("value", row.value, "Attribute value"),
    requireEnum("confidence", row.confidence, CONFIDENCE_LEVELS, "Confidence", false),
  );
}

function validateTag(row: TagInsert): ValidationError[] {
  return collectErrors(
    requireField("name", row.name, "Tag name"),
    requireEnum("category", row.category, TAG_CATEGORIES, "Category", false),
  );
}

function validateRecordTag(row: RecordTagInsert): ValidationError[] {
  return collectErrors(
    requireField("record_id", row.record_id, "Record ID"),
    requireField("record_table", row.record_table, "Record table"),
    requireField("tag_id", row.tag_id, "Tag ID"),
  );
}

export function validateProposedRow(
  table: TableName,
  row: unknown
): ValidationError[] {
  if (!row || typeof row !== "object") {
    return [{ field: "_root", message: "Invalid row data" }];
  }

  switch (table) {
    case "entities":
      return validateEntity(row as EntityInsert);
    case "identifiers":
      return validateIdentifier(row as IdentifierInsert);
    case "relations":
      return validateRelation(row as RelationInsert);
    case "intel":
      return validateIntel(row as IntelInsert);
    case "intel_entities":
      return validateIntelEntity(row as IntelEntityInsert);
    case "sources":
      return validateSource(row as SourceInsert);
    case "entity_attributes":
      return validateEntityAttribute(row as EntityAttributeInsert);
    case "tags":
      return validateTag(row as TagInsert);
    case "record_tags":
      return validateRecordTag(row as RecordTagInsert);
    default:
      return [];
  }
}
