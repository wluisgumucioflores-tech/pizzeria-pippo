import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';

// Defense in depth for the produccion role on Stock/Bodega endpoints: the
// role guard alone only checks `role === 'produccion'`, which would stay
// true even after the business turns the `produccionStock` module off.
// This re-checks enabled_modules on every request, same pattern as
// ProductionService.assertModuleEnabled for the produccion module itself.
// Admins are never affected by this guard.
@Injectable()
export class ProduccionStockGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: CurrentUserPayload | undefined = context.switchToHttp().getRequest().user;
    if (user?.role === 'produccion' && !user.enabled_modules.produccionStock) {
      throw new ForbiddenException('Tu negocio no tiene habilitado el acceso a Stock/Bodega para producción.');
    }
    return true;
  }
}
