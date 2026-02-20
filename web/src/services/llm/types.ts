import type { Json } from "@/types/database";

export type ConfidenceLevel =
  | "confirmed"
  | "high"
  | "medium"
  | "low"
  | "unconfirmed";

export type EntityType =
  | "person"
  | "organization"
  | "group"
  | "vehicle"
  | "location"
  | "event";

export type IdentifierType =
  | "name"
  | "document"
  | "biometric"
  | "phone"
  | "email"
  | "handle"
  | "address"
  | "registration"
  | "domain";

export type RelationType =
  | "parent"
  | "child"
  | "sibling"
  | "spouse"
  | "colleague"
  | "associate"
  | "friend"
  | "member"
  | "owner"
  | "founder"
  | "co-founder"
  | "visited"
  | "employee";

export type IntelType =
  | "event"
  | "communication"
  | "sighting"
  | "report"
  | "document"
  | "media"
  | "financial";

export interface IdentifierExtraction {
  identifier_type: IdentifierType;
  value: string;
  metadata?: Record<string, Json> | null;
}

export interface EntityExtraction {
  name: string;
  entity_type: EntityType;
  identifiers: IdentifierExtraction[];
  attributes: Record<string, Json>;
  confidence: ConfidenceLevel;
  source_reference?: string | null;
}

export interface RelationExtraction {
  source_entity_name: string;
  target_entity_name: string;
  relation_type: RelationType;
  strength?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  description?: string | null;
  confidence: ConfidenceLevel;
  source_reference?: string | null;
}

export interface IntelExtraction {
  intel_type: IntelType;
  description: string;
  occurred_at?: string | null;
  entities_involved: string[];
  location?: string | null;
  details: Record<string, Json>;
  confidence: ConfidenceLevel;
  source_reference?: string | null;
}

export interface Reasoning {
  entities_identified: string;
  relationships_identified: string;
  facts_identified: string;
  events_identified: string;
  sources_identified: string;
  confidence_rationale: string;
}

export interface EntityResolutionCandidate {
  entity_id: string;
  name: string;
  type: EntityType;
  match_score: number;
  reasoning: string;
}

export interface EntityResolution {
  entity_ref: string;
  status: "resolved" | "new" | "ambiguous";
  resolved_entity_id?: string;
  candidates?: EntityResolutionCandidate[];
  reasoning?: string;
}

export interface ClarificationRequest {
  question: string;
  context: string;
  options?: string[];
  related_entities?: string[];
}

export interface IntelligenceExtraction {
  reasoning: Reasoning;
  entities: EntityExtraction[];
  relations: RelationExtraction[];
  intel: IntelExtraction[];
  resolutions?: EntityResolution[];
  clarifications?: ClarificationRequest[];
}

export type Classification = "fact_update" | "event_log" | "mixed";

export interface SyncResults {
  entities_created?: Array<Record<string, unknown>>;
  entities_updated?: Array<Record<string, unknown>>;
  relations_created?: Array<Record<string, unknown>>;
  intel_created?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ClassifiedExtractionResponse {
  classification: Classification;
  chain_of_thought: string;
  extraction: IntelligenceExtraction;
  sync_results?: SyncResults | null;
}

export interface ExtractionRequest {
  text: string;
  context?: string | null;
  source_code?: string | null;
  sync_to_db?: boolean;
}

export interface HealthResponse {
  status: string;
  provider: string;
  model: string;
}
