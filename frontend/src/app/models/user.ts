export interface User {
  user_id: number | null;
  username: string | null;
  email: string | null;
  role_id: number | null;
  created_at?: Date;
}

export enum RoleType {
  ADMINISTRATOR = 0,
  MANAGEMENT = 1,
  REGULAR_USER = 2,
  UNREGISTERED = 3
}
