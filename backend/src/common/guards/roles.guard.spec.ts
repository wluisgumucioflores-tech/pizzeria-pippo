import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const makeContext = (user?: CurrentUserPayload): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  };

  const user = (role: string): CurrentUserPayload => ({
    id: 'u1',
    email: 'test@pippo.local',
    role,
    branch_id: null,
    full_name: 'Test',
    business_id: null,
    enabled_modules: DEFAULT_ENABLED_MODULES,
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite el acceso si el endpoint no tiene @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(user('cajero')))).toBe(true);
  });

  it('permite el acceso si el rol del usuario está en la lista requerida', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(makeContext(user('admin')))).toBe(true);
  });

  it('permite el acceso si el rol coincide con alguno de varios roles permitidos', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'cajero']);
    expect(guard.canActivate(makeContext(user('cajero')))).toBe(true);
  });

  it('rechaza si el rol del usuario no está en la lista requerida', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(makeContext(user('cocinero')))).toThrow(ForbiddenException);
  });

  it('rechaza si no hay usuario en el request', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
