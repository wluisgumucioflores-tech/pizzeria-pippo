import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from './types/jwt.types';
import { DEFAULT_ENABLED_MODULES, type EnabledModules } from '@pippo/shared';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: CurrentUserPayload) {
    const business = user.business_id
      ? await this.prisma.business.findUnique({ where: { id: user.business_id }, select: { name: true, enabledModules: true } })
      : null;

    const enabledModules = { ...DEFAULT_ENABLED_MODULES, ...(business?.enabledModules as Partial<EnabledModules> | undefined) };

    return { ...user, business_name: business?.name ?? null, enabled_modules: enabledModules };
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: CurrentUserPayload) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { success: true };
  }
}
