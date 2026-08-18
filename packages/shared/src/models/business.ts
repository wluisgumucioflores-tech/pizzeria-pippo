import type { EnabledModules } from "../constants/business-modules";

export interface Business {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  enabled_modules: EnabledModules;
}
