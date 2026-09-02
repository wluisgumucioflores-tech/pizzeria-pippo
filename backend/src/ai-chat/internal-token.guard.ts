import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

// Server-to-server auth for internal platform calls (e.g. the Spring
// orchestrator service requesting the runtime config). Validates a shared
// secret via header. Fail-closed: if PIPPO_INTERNAL_TOKEN isn't set,
// it rejects everything.
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PIPPO_INTERNAL_TOKEN;
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header('x-internal-token');
    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Token interno inválido');
    }
    return true;
  }
}
