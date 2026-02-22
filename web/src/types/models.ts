export interface UserEntity {
  id: string;
  type: "person";
  data: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface User {
  id: string;
  entityId: string;
  email: string;
  entity?: UserEntity;
}
