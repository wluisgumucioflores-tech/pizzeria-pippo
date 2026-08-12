export type UserRole = "admin" | "cajero" | "cocinero" | "mesero";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  created_at: string;
  is_banned: boolean;
  has_orders: boolean;
}

export interface Branch {
  id: string;
  name: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
}

export interface UpdateUserPayload {
  full_name: string;
  role: UserRole;
  branch_id: string | null;
}
