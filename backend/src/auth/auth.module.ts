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
  // JwtModule is re-exported so other modules that import AuthModule (e.g.
  // McpModule, to sign its own short-lived agent tokens) can inject
  // JwtService without registering a second JwtModule of their own.
  exports: [JwtAuthGuard, AuthService, JwtModule],
})
export class AuthModule {}
