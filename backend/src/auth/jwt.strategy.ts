import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { toCurrentUserPayload } from './current-user.mapper';
import type { AppJwtPayload, CurrentUserPayload } from './types/jwt.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no está configurado (ver backend/.env)');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: AppJwtPayload): Promise<CurrentUserPayload> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
      include: { business: true },
    });
    if (!profile || profile.isBanned || profile.business?.isActive === false) {
      throw new UnauthorizedException('Perfil no encontrado');
    }

    return toCurrentUserPayload(profile);
  }
}
