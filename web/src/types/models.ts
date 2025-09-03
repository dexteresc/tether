/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BaseModel {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Entity extends BaseModel {
  type: "person" | "organization" | "vehicle" | "location" | "group";
  data?: Record<string, any>;
  identifiers?: Identifier[];
  relations?: Relation[];
}

export interface Identifier extends BaseModel {
  entityId: string;
  type: "email" | "phone" | "document" | "license" | "passport" | "other";
  value: string;
  verified: boolean;
  metadata?: Record<string, any>;
}

export interface Relation extends BaseModel {
  fromEntityId: string;
  toEntityId: string;
  relationType:
    | "parent"
    | "child"
    | "colleague"
    | "associate"
    | "member"
    | "owns"
    | "other";
  metadata?: Record<string, any>;
  fromEntity?: Entity;
  toEntity?: Entity;
}

export interface Intel extends BaseModel {
  type: "event" | "sighting" | "communication" | "document" | "other";
  title: string;
  content: string;
  classification: "public" | "confidential" | "secret" | "top-secret";
  source?: string;
  entityIds: string[];
  entities?: Entity[];
  metadata?: Record<string, any>;
}

export interface User {
  id: string;
  entityId: string;
  email: string;
  entity?: Entity;
}
