import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { SettingsResult } from './types/settings-result.types';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import type { TestTelegramDto } from './dto/test-telegram.dto';

const SETTINGS_KEYS = [
  'telegram_bot_token',
  'telegram_chat_id',
  'telegram_enabled',
  'kitchen_late_threshold_minutes',
  'printer_paper_width',
  'printer_business_name',
  'use_stock',
];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(user: CurrentUserPayload): Promise<SettingsResult> {
    const businessId = this.resolveBusinessId(user);
    const rows = await this.prisma.appSetting.findMany({
      where: { businessId, key: { in: SETTINGS_KEYS } },
    });
    const config = new Map(rows.map((r) => [r.key, r.value]));

    return {
      telegram_bot_token: this.maskToken(
        config.get('telegram_bot_token') ?? '',
      ),
      telegram_chat_id: config.get('telegram_chat_id') ?? '',
      telegram_enabled: config.get('telegram_enabled') === 'true',
      kitchen_late_threshold_minutes: parseInt(
        config.get('kitchen_late_threshold_minutes') ?? '10',
        10,
      ),
      printer_paper_width: parseInt(
        config.get('printer_paper_width') ?? '58',
        10,
      ),
      printer_business_name:
        config.get('printer_business_name')?.trim() || 'GU PIZZA',
      // Sin fila guardada todavía = negocio existente de antes de esta
      // feature — mantiene el comportamiento actual (stock activado) en vez
      // de desactivarlo silenciosamente.
      use_stock: config.get('use_stock') !== 'false',
    };
  }

  async updateSettings(
    user: CurrentUserPayload,
    dto: UpdateSettingsDto,
  ): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const paperWidth = dto.printer_paper_width === 80 ? 80 : 58;

    const entries: Array<[string, string]> = [
      ['telegram_chat_id', dto.telegram_chat_id ?? ''],
      ['telegram_enabled', String(dto.telegram_enabled ?? false)],
      [
        'kitchen_late_threshold_minutes',
        String(dto.kitchen_late_threshold_minutes ?? 10),
      ],
      ['printer_paper_width', String(paperWidth)],
      [
        'printer_business_name',
        dto.printer_business_name?.trim() || 'GU PIZZA',
      ],
      ['use_stock', String(dto.use_stock ?? true)],
    ];

    if (dto.telegram_bot_token && !dto.telegram_bot_token.includes('***')) {
      entries.push(['telegram_bot_token', dto.telegram_bot_token]);
    }

    await Promise.all(
      entries.map(([key, value]) =>
        this.prisma.appSetting.upsert({
          where: { businessId_key: { businessId, key } },
          create: { businessId, key, value },
          update: { value, updatedAt: new Date() },
        }),
      ),
    );
  }

  async getPrinterSettings(
    user: CurrentUserPayload,
  ): Promise<{ printer_paper_width: number; printer_business_name: string }> {
    const businessId = this.resolveBusinessId(user);
    const rows = await this.prisma.appSetting.findMany({
      where: {
        businessId,
        key: { in: ['printer_paper_width', 'printer_business_name'] },
      },
    });
    const config = new Map(rows.map((row) => [row.key, row.value]));
    const width = parseInt(config.get('printer_paper_width') ?? '58', 10);
    return {
      printer_paper_width: width === 80 ? 80 : 58,
      printer_business_name:
        config.get('printer_business_name')?.trim() || 'GU PIZZA',
    };
  }

  // No RolesGuard in the controller — any authenticated user can read this.
  // Fix for the documented bug: previously app_settings' RLS was admin-only and
  // the cocinero role could never read the configured threshold.
  async getKitchenLateThresholdMinutes(
    user: CurrentUserPayload,
  ): Promise<number> {
    const businessId = this.resolveBusinessId(user);
    const row = await this.prisma.appSetting.findUnique({
      where: {
        businessId_key: { businessId, key: 'kitchen_late_threshold_minutes' },
      },
    });
    return parseInt(row?.value ?? '10', 10);
  }

  // Usado tanto por el POS/Mesero (catálogo — ver si bloquear productos sin
  // stock) como por OrdersService (server-side — ver si descontar stock al
  // vender/anular). No RolesGuard en el controller, mismo criterio que el
  // umbral de cocina: cualquier rol autenticado puede necesitarlo.
  async isStockTrackingEnabled(user: CurrentUserPayload): Promise<boolean> {
    const businessId = this.resolveBusinessId(user);
    const row = await this.prisma.appSetting.findUnique({
      where: { businessId_key: { businessId, key: 'use_stock' } },
    });
    return row?.value !== 'false';
  }

  // Generic key-value store for config that doesn't fit SettingsResult's
  // fixed shape (e.g. the Telegram AI bot config: provider, model,
  // per-plan limits — a different, larger set of keys).
  async getRawSettings(
    user: CurrentUserPayload,
    keys: string[],
  ): Promise<Record<string, string>> {
    const businessId = this.resolveBusinessId(user);
    const rows = await this.prisma.appSetting.findMany({
      where: { businessId, key: { in: keys } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  // Used by the Telegram webhook, which has no user JWT (Telegram calls it
  // directly). Only one business exists today, so it's resolved without a
  // user context — the Telegram bot config is effectively global, matching
  // telegram_authorized_chats/telegram_usage (also without business_id).
  async getRawSettingsForFirstBusiness(
    keys: string[],
  ): Promise<Record<string, string>> {
    const business = await this.prisma.business.findFirst();
    if (!business) return {};
    const rows = await this.prisma.appSetting.findMany({
      where: { businessId: business.id, key: { in: keys } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async saveRawSettings(
    user: CurrentUserPayload,
    updates: { key: string; value: string }[],
  ): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    await Promise.all(
      updates.map(({ key, value }) =>
        this.prisma.appSetting.upsert({
          where: { businessId_key: { businessId, key } },
          create: { businessId, key, value },
          update: { value, updatedAt: new Date() },
        }),
      ),
    );
  }

  async testTelegramConnection(
    dto: TestTelegramDto,
  ): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${dto.telegram_bot_token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: dto.telegram_chat_id,
            text: '✅ *Pizzería Pippo* — Conexión de notificaciones configurada correctamente.',
            parse_mode: 'Markdown',
          }),
        },
      );
      const data = (await res.json()) as { ok: boolean; description?: string };

      if (!data.ok) {
        return {
          ok: false,
          error: data.description ?? 'Error desconocido de Telegram',
        };
      }
      return { ok: true, message: 'Mensaje de prueba enviado correctamente' };
    } catch {
      return { ok: false, error: 'No se pudo conectar con Telegram' };
    }
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException(
        'El usuario no tiene un negocio asociado',
      );
    }
    return user.business_id;
  }

  private maskToken(token: string): string {
    if (!token || token.length < 10) return token;
    return token.slice(0, 6) + '***' + token.slice(-3);
  }
}
