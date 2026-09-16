export interface AppJwtPayload {
  sub: string;
}

import type { EnabledModules } from '@pippo/shared';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: string;
  branch_id: string | null;
  full_name: string | null;
  business_id: string | null;
  enabled_modules: EnabledModules;
}
