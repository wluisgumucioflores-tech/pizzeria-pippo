import type { EnabledModules } from "@pippo/shared";

export type { Business, EnabledModules } from "@pippo/shared";

export interface CreateBusinessInput {
  name: string;
  admin: {
    email: string;
    password: string;
    full_name: string;
  };
  enabled_modules?: Partial<EnabledModules>;
  ai_chat_plan_id?: string;
}

export interface UpdateBusinessInput {
  name?: string;
  enabled_modules?: Partial<EnabledModules>;
  ai_chat_plan_id?: string;
}
