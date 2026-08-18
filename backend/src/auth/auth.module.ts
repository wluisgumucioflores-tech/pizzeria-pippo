import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordModule } from './password/password.module';

@Module({
  imports: [
    PassportModule,
    PasswordModule,
    // No options here on purpose: JwtModule.register() is evaluated when
    // this file is imported, before ConfigModule loads the .env, so reading
    // process.env.JWT_SECRET at this point would be undefined. The
    // secret/expiresIn are passed on every sign()/verify() call in
    // AuthService instead, which runs at real runtime.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, JwtAuthGuard, AuthService],
  // JwtModule también se reexporta: ai-chat necesita JwtService para firmar
  // los JWT de corta duración del agente (mismo secret que AuthService, pasado
  // explícito en cada sign()/verify() — ver comentario arriba).
  exports: [JwtAuthGuard, AuthService, JwtModule],
})
export class AuthModule {}
