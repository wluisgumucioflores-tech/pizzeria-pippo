import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ProduccionStockGuard } from './produccion-stock.guard';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';

describe('ProduccionStockGuard', () => {
  let guard: ProduccionStockGuard;

  const makeContext = (user: CurrentUserPayload | undefined): ExecutionContext => {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  };

  const user = (role: string, produccionStock: boolean): CurrentUserPayload => ({
    id: 'u1',
    email: 'test@pippo.local',
    role,
    branch_id: null,
    full_name: 'Test',
    business_id: 'b1',
    enabled_modules: { ...DEFAULT_ENABLED_MODULES, produccionStock },
  });

  beforeEach(() => {
    guard = new ProduccionStockGuard();
  });

  it('permite el acceso a produccion si produccionStock está habilitado', () => {
    expect(guard.canActivate(makeContext(user('produccion', true)))).toBe(true);
  });

  it('rechaza a produccion si produccionStock está deshabilitado', () => {
    expect(() => guard.canActivate(makeContext(user('produccion', false)))).toThrow(ForbiddenException);
  });

  it('permite el acceso a admin sin importar produccionStock', () => {
    expect(guard.canActivate(makeContext(user('admin', false)))).toBe(true);
  });
});
