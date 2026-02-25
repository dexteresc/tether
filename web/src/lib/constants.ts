export const ENTITY_TYPES = ["person", "organization", "group", "location", "event", "project", "asset"] as const;
export const ENTITY_STATUSES = ["active", "inactive", "archived"] as const;
export const IDENTIFIER_TYPES = ["name", "alias", "document", "phone", "email", "handle", "address", "registration", "domain", "website", "account_id", "biometric"] as const;
export const RELATION_TYPES = ["parent", "child", "sibling", "spouse", "relative", "colleague", "associate", "friend", "employee", "member", "owner", "founder", "co-founder", "mentor", "client", "partner", "introduced_by", "works_at", "lives_in", "invested_in", "attended", "visited", "knows"] as const;
export const INTEL_TYPES = ["event", "communication", "sighting", "report", "document", "media", "financial", "note", "tip"] as const;
export const CONFIDENCE_LEVELS = ["confirmed", "high", "medium", "low", "unconfirmed"] as const;
export const SENSITIVITY_LEVELS = ["open", "internal", "confidential", "restricted"] as const;
export const TAG_CATEGORIES = ["topic", "geographic", "project", "personal"] as const;
export const SOURCE_TYPES = ["humint", "sigint", "osint", "document", "media", "other"] as const;
export const RELIABILITY_LEVELS = ["A", "B", "C", "D", "E", "F"] as const;

export const ATTRIBUTE_DEFINITIONS = [
  { key: "employer", label: "Employer", data_type: "text", applies_to: ["person"] },
  { key: "job_title", label: "Job Title", data_type: "text", applies_to: ["person"] },
  { key: "nationality", label: "Nationality", data_type: "text", applies_to: ["person"] },
  { key: "date_of_birth", label: "Date of Birth", data_type: "date", applies_to: ["person"] },
  { key: "gender", label: "Gender", data_type: "text", applies_to: ["person"] },
  { key: "ethnicity", label: "Ethnicity", data_type: "text", applies_to: ["person"] },
  { key: "height", label: "Height", data_type: "text", applies_to: ["person"] },
  { key: "weight", label: "Weight", data_type: "text", applies_to: ["person"] },
  { key: "hair_color", label: "Hair Color", data_type: "text", applies_to: ["person"] },
  { key: "eye_color", label: "Eye Color", data_type: "text", applies_to: ["person"] },
  { key: "distinguishing_marks", label: "Distinguishing Marks", data_type: "text", applies_to: ["person"] },
  { key: "spoken_languages", label: "Spoken Languages", data_type: "text", applies_to: ["person"] },
  { key: "industry", label: "Industry", data_type: "text", applies_to: ["organization", "group"] },
  { key: "headquarters", label: "Headquarters", data_type: "text", applies_to: ["organization"] },
  { key: "founded", label: "Founded", data_type: "date", applies_to: ["organization", "group"] },
  { key: "employee_count", label: "Employee Count", data_type: "number", applies_to: ["organization"] },
  { key: "revenue", label: "Revenue", data_type: "text", applies_to: ["organization"] },
  { key: "country", label: "Country", data_type: "text", applies_to: ["location"] },
  { key: "city", label: "City", data_type: "text", applies_to: ["location"] },
  { key: "coordinates", label: "Coordinates", data_type: "text", applies_to: ["location"] },
  { key: "event_date", label: "Event Date", data_type: "date", applies_to: ["event"] },
  { key: "event_location", label: "Event Location", data_type: "text", applies_to: ["event"] },
  { key: "project_status", label: "Project Status", data_type: "text", applies_to: ["project"] },
  { key: "asset_type", label: "Asset Type", data_type: "text", applies_to: ["asset"] },
  { key: "asset_value", label: "Asset Value", data_type: "text", applies_to: ["asset"] },
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type EntityStatus = (typeof ENTITY_STATUSES)[number];
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];
export type RelationType = (typeof RELATION_TYPES)[number];
export type IntelType = (typeof INTEL_TYPES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];
export type TagCategory = (typeof TAG_CATEGORIES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type ReliabilityLevel = (typeof RELIABILITY_LEVELS)[number];
