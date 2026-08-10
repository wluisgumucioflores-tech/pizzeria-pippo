export type { Business } from "@pippo/shared";

export interface CreateBusinessInput {
  name: string;
  admin: {
    email: string;
    password: string;
    full_name: string;
  };
}
