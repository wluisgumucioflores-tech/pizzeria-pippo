import type { EnabledModules } from '@pippo/shared';

export interface BusinessResult {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  enabled_modules: EnabledModules;
}
