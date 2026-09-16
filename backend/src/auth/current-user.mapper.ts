import type { Business, Profile } from '@prisma/client';
import { DEFAULT_ENABLED_MODULES, type EnabledModules } from '@pippo/shared';
import type { CurrentUserPayload } from './types/jwt.types';

export function toCurrentUserPayload(profile: Profile & { business: Business | null }): CurrentUserPayload {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    branch_id: profile.branchId,
    full_name: profile.fullName,
    business_id: profile.businessId,
    enabled_modules: {
      ...DEFAULT_ENABLED_MODULES,
      ...(profile.business?.enabledModules as Partial<EnabledModules> | undefined),
    },
  };
}
