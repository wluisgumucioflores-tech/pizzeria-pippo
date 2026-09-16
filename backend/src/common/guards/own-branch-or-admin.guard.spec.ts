import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OwnBranchOrAdminGuard } from './own-branch-or-admin.guard';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';

describe('OwnBranchOrAdminGuard', () => {
  let guard: OwnBranchOrAdminGuard;

  const makeContext = (user: CurrentUserPayload | undefined, query: Record<string, string> = {}, body: Record<string, string> = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user, query, body }) }),
    } as unknown as ExecutionContext;
  };

  const user = (role: string, branchId: string | null): CurrentUserPayload => ({
    id: 'u1',
    email: 'test@pippo.local',
    role,
    branch_id: branchId,
    full_name: 'Test',
    business_id: null,
    enabled_modules: DEFAULT_ENABLED_MODULES,
  });

  beforeEach(() => {
    guard = new OwnBranchOrAdminGuard();
  });

  it('permite el acceso a un admin sin importar el branchId', () => {
    expect(guard.canActivate(makeContext(user('admin', null), { branchId: 'b1' }))).toBe(true);
  });

  it('permite el acceso si el branchId de la query coincide con la sucursal del usuario', () => {
    expect(guard.canActivate(makeContext(user('cajero', 'b1'), { branchId: 'b1' }))).toBe(true);
  });

  it('permite el acceso si el branch_id del body coincide con la sucursal del usuario', () => {
    expect(guard.canActivate(makeContext(user('cajero', 'b1'), {}, { branch_id: 'b1' }))).toBe(true);
  });

  it('rechaza si el branchId no coincide con la sucursal del usuario', () => {
    expect(() => guard.canActivate(makeContext(user('cajero', 'b1'), { branchId: 'b2' }))).toThrow(ForbiddenException);
  });

  it('rechaza si no hay usuario en el request', () => {
    expect(() => guard.canActivate(makeContext(undefined, { branchId: 'b1' }))).toThrow(ForbiddenException);
  });
});
