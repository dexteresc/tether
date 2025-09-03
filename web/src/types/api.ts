import type { Entity, Intel, Relation, User } from "./models";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface EntityFilters extends PaginationParams {
  type?: Entity["type"];
  search?: string;
  includeDeleted?: boolean;
}

export interface RelationFilters extends PaginationParams {
  entityId?: string;
  relationType?: Relation["relationType"];
}

export interface IntelFilters extends PaginationParams {
  entityId?: string;
  type?: Intel["type"];
  dateFrom?: string;
  dateTo?: string;
  classification?: Intel["classification"];
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
