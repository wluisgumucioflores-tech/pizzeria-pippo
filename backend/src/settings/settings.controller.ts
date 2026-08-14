import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TestTelegramDto } from './dto/test-telegram.dto';
import { GetRawSettingsQueryDto } from './dto/get-raw-settings-query.dto';
import { SaveRawSettingsDto } from './dto/save-raw-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  getSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.settingsService.getSettings(user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put()
  updateSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user, dto);
  }

  // No RolesGuard: any authenticated user (POS/cashier) can read ticket settings.
  @Get('printer')
  getPrinterSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.settingsService.getPrinterSettings(user);
  }

  // No RolesGuard: fix for the RLS bug — cocinero needs to read this (see Fase 3 plan).
  // También devuelve kitchen_display_mode para no sumar otra llamada desde Cocina.
  @Get('kitchen-threshold')
  async getKitchenThreshold(@CurrentUser() user: CurrentUserPayload) {
    const [kitchen_late_threshold_minutes, kitchen_display_mode] =
      await Promise.all([
        this.settingsService.getKitchenLateThresholdMinutes(user),
        this.settingsService.getKitchenDisplayMode(user),
      ]);
    return { kitchen_late_threshold_minutes, kitchen_display_mode };
  }

  // No RolesGuard: cajero/mesero necesitan saber esto para el catálogo del POS.
  @Get('stock')
  getUseStock(@CurrentUser() user: CurrentUserPayload) {
    return this.settingsService
      .isStockTrackingEnabled(user)
      .then((use_stock) => ({ use_stock }));
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('test')
  testTelegram(@Body() dto: TestTelegramDto) {
    return this.settingsService.testTelegramConnection(dto);
  }

  // Telegram AI bot config (provider, model, per-plan limits) — doesn't
  // fit GET/PUT /settings' fixed shape, uses the generic store instead.
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('raw')
  getRawSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: GetRawSettingsQueryDto,
  ) {
    return this.settingsService.getRawSettings(user, query.keys.split(','));
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put('raw')
  saveRawSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SaveRawSettingsDto,
  ) {
    return this.settingsService.saveRawSettings(user, dto.updates);
  }
}
