import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { SettingsResult } from './types/settings-result.types';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import type { TestTelegramDto } from './dto/test-telegram.dto';

// telegram_bot_token/telegram_chat_id/telegram_enabled used to live here —
// moved to the TelegramBotConfig table (see
// docs/features/chat-ia-backend/plan-integracion-telegram.md, Fase 2) so a
// single row can also carry chat_ia_enabled + webhook secrets.
const SETTINGS_KEYS = [
  'kitchen_stage_warning_minutes',
  'kitchen_late_threshold_minutes',
  'kitchen_visible_category_ids',
  'kitchen_color_fresh',
  'kitchen_color_warning',
  'kitchen_color_late',
  'printer_paper_width',
  'printer_business_name',
  'use_stock',
  'pos_enable_table_number',
];

const KITCHEN_STAGE_KEYS = [
  'kitchen_stage_warning_minutes',
  'kitchen_late_threshold_minutes',
  'kitchen_color_fresh',
  'kitchen_color_warning',
  'kitchen_color_late',
  'kitchen_visible_category_ids',
];

// Clave legada del binario "modo completo"/"solo pizzas" — ya no se lee ni
// escribe en SETTINGS_KEYS/KITCHEN_STAGE_KEYS, pero las filas viejas siguen
// en app_settings. Se usa una sola vez para no resetear silenciosamente el
// filtro de un negocio que ya tenía "solo pizzas" activo antes de migrar.
const LEGACY_KITCHEN_DISPLAY_MODE_KEY = 'kitchen_display_mode';

const KITCHEN_STAGE_DEFAULTS = {
  kitchen_stage_warning_minutes: 7,
  // Mismo default que ya tenía kitchen_late_threshold_minutes antes de esta
  // feature (migración 027) — se mantiene para no cambiar el comportamiento
  // de negocios existentes que nunca configuraron nada.
  kitchen_late_threshold_minutes: 10,
  kitchen_color_fresh: '#16a34a',
  kitchen_color_warning: '#d97706',
  kitchen_color_late: '#dc2626',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(user: CurrentUserPayload): Promise<SettingsResult> {
    const businessId = this.resolveBusinessId(user);
    const [rows, telegramBotConfig] = await Promise.all([
      this.prisma.appSetting.findMany({
        where: { businessId, key: { in: SETTINGS_KEYS } },
      }),
      this.prisma.telegramBotConfig.findUnique({ where: { businessId } }),
    ]);
    const config = new Map(rows.map((r) => [r.key, r.value]));
    const kitchenVisibleCategoryIds = await this.resolveVisibleCategoryIds(businessId, config);

    return {
      telegram_bot_token: this.maskToken(telegramBotConfig?.botToken ?? ''),
      telegram_chat_id: telegramBotConfig?.chatId ?? '',
      telegram_enabled: telegramBotConfig?.notificationsEnabled ?? false,
      chat_ia_enabled: telegramBotConfig?.chatIaEnabled ?? false,
      kitchen_stage_warning_minutes: parseInt(
        config.get('kitchen_stage_warning_minutes') ??
          String(KITCHEN_STAGE_DEFAULTS.kitchen_stage_warning_minutes),
        10,
      ),
      kitchen_late_threshold_minutes: parseInt(
        config.get('kitchen_late_threshold_minutes') ??
          String(KITCHEN_STAGE_DEFAULTS.kitchen_late_threshold_minutes),
        10,
      ),
      kitchen_visible_category_ids: kitchenVisibleCategoryIds,
      kitchen_color_fresh:
        config.get('kitchen_color_fresh') ??
        KITCHEN_STAGE_DEFAULTS.kitchen_color_fresh,
      kitchen_color_warning:
        config.get('kitchen_color_warning') ??
        KITCHEN_STAGE_DEFAULTS.kitchen_color_warning,
      kitchen_color_late:
        config.get('kitchen_color_late') ??
        KITCHEN_STAGE_DEFAULTS.kitchen_color_late,
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
      // Opt-in: negocios sin mesas (delivery/takeaway puro) no quieren este
      // campo en el cajero, así que arranca desactivado salvo que se active.
      pos_enable_table_number: config.get('pos_enable_table_number') === 'true',
    };
  }

  async updateSettings(
    user: CurrentUserPayload,
    dto: UpdateSettingsDto,
  ): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const paperWidth = dto.printer_paper_width === 80 ? 80 : 58;

    const warningMinutes =
      dto.kitchen_stage_warning_minutes ??
      KITCHEN_STAGE_DEFAULTS.kitchen_stage_warning_minutes;
    const lateMinutes =
      dto.kitchen_late_threshold_minutes ??
      KITCHEN_STAGE_DEFAULTS.kitchen_late_threshold_minutes;
    if (warningMinutes >= lateMinutes) {
      throw new BadRequestException(
        'kitchen_stage_warning_minutes debe ser menor que kitchen_late_threshold_minutes',
      );
    }

    const entries: Array<[string, string]> = [
      ['kitchen_stage_warning_minutes', String(warningMinutes)],
      ['kitchen_late_threshold_minutes', String(lateMinutes)],
      [
        'kitchen_color_fresh',
        dto.kitchen_color_fresh ?? KITCHEN_STAGE_DEFAULTS.kitchen_color_fresh,
      ],
      [
        'kitchen_color_warning',
        dto.kitchen_color_warning ??
          KITCHEN_STAGE_DEFAULTS.kitchen_color_warning,
      ],
      [
        'kitchen_color_late',
        dto.kitchen_color_late ?? KITCHEN_STAGE_DEFAULTS.kitchen_color_late,
      ],
      [
        'kitchen_visible_category_ids',
        JSON.stringify(dto.kitchen_visible_category_ids ?? []),
      ],
      ['printer_paper_width', String(paperWidth)],
      [
        'printer_business_name',
        dto.printer_business_name?.trim() || 'GU PIZZA',
      ],
      ['use_stock', String(dto.use_stock ?? true)],
      [
        'pos_enable_table_number',
        String(dto.pos_enable_table_number ?? false),
      ],
    ];

    await Promise.all([
      ...entries.map(([key, value]) =>
        this.prisma.appSetting.upsert({
          where: { businessId_key: { businessId, key } },
          create: { businessId, key, value },
          update: { value, updatedAt: new Date() },
        }),
      ),
      this.upsertTelegramBotConfig(businessId, dto),
    ]);
  }

  // telegram_bot_token/telegram_chat_id/telegram_enabled/chat_ia_enabled from
  // this same form all live in TelegramBotConfig (see
  // docs/features/chat-ia-backend/plan-integracion-telegram.md). bot_token is
  // NOT NULL there, so a business that never configured Telegram and saves
  // some other tab (kitchen/printer/etc., which still round-trips empty
  // telegram_* fields through this same DTO) must not create a bogus row —
  // only create one when a real, unmasked token is actually provided; once a
  // row exists, just update the other fields on it.
  private async upsertTelegramBotConfig(
    businessId: string,
    dto: UpdateSettingsDto,
  ): Promise<void> {
    const existing = await this.prisma.telegramBotConfig.findUnique({
      where: { businessId },
    });
    const hasRealToken =
      !!dto.telegram_bot_token && !dto.telegram_bot_token.includes('***');

    if (!existing && !hasRealToken) return;

    const botToken = hasRealToken ? dto.telegram_bot_token! : existing!.botToken;
    const chatId = dto.telegram_chat_id ?? existing?.chatId ?? '';
    const notificationsEnabled = dto.telegram_enabled ?? existing?.notificationsEnabled ?? false;
    const chatIaEnabled = dto.chat_ia_enabled ?? existing?.chatIaEnabled ?? false;
    const wasChatIaEnabled = existing?.chatIaEnabled ?? false;

    // Generated once, the first time chat-ia gets activated — reused on every
    // later toggle so the webhook URL/secret don't change under a business
    // that's already registered on Telegram's side.
    let webhookToken = existing?.webhookToken ?? null;
    let webhookSecret = existing?.webhookSecret ?? null;
    if (chatIaEnabled && (!webhookToken || !webhookSecret)) {
      webhookToken = randomBytes(24).toString('hex');
      webhookSecret = randomBytes(32).toString('hex');
    }

    // Talk to Telegram BEFORE writing chat_ia_enabled=true to the DB. If this
    // throws (BACKEND_PUBLIC_URL missing, bad token, Telegram rejects it),
    // the whole save fails and the row keeps chat_ia_enabled=false — so the
    // next save attempt still sees a false→true transition and retries
    // registration, instead of silently believing it's already active
    // forever (this was the actual bug: DB said "on", Telegram never got the
    // webhook, and no later save ever tried setWebhook again).
    if (chatIaEnabled && !wasChatIaEnabled) {
      await this.registerTelegramWebhook(botToken, webhookToken!, webhookSecret!);
    } else if (!chatIaEnabled && wasChatIaEnabled) {
      await this.deleteTelegramWebhook(botToken);
    }

    await this.prisma.telegramBotConfig.upsert({
      where: { businessId },
      create: { businessId, botToken, chatId, notificationsEnabled, chatIaEnabled, webhookToken, webhookSecret },
      update: {
        ...(hasRealToken ? { botToken: dto.telegram_bot_token } : {}),
        chatId,
        notificationsEnabled,
        chatIaEnabled,
        webhookToken,
        webhookSecret,
        updatedAt: new Date(),
      },
    });
  }

  // Enabling is a deliberate admin action — if Telegram rejects the webhook
  // (bad token, unreachable URL), the admin needs to see it fail now, not
  // discover later that the switch was on but silently doing nothing.
  private async registerTelegramWebhook(
    botToken: string,
    webhookToken: string,
    webhookSecret: string,
  ): Promise<void> {
    const publicUrl = process.env.BACKEND_PUBLIC_URL;
    if (!publicUrl) {
      throw new BadRequestException(
        'El servidor no tiene configurada una URL pública (BACKEND_PUBLIC_URL) — no se puede activar el chat IA por Telegram.',
      );
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${publicUrl}/telegram-chat-ia/webhook/${webhookToken}`,
        secret_token: webhookSecret,
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      throw new BadRequestException(
        `No se pudo activar el webhook de Telegram: ${data.description ?? 'error desconocido'}`,
      );
    }
  }

  // Disabling is best-effort — the webhook controller already no-ops once
  // chat_ia_enabled is false, so a failed deleteWebhook here (network blip,
  // bot deleted on Telegram's side) shouldn't block turning the switch off.
  private async deleteTelegramWebhook(botToken: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, { method: 'POST' });
    } catch (err) {
      console.error('[SettingsService] Error desactivando webhook de Telegram chat-ia:', err);
    }
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
  async getKitchenStageSettings(user: CurrentUserPayload): Promise<{
    kitchen_stage_warning_minutes: number;
    kitchen_late_threshold_minutes: number;
    kitchen_color_fresh: string;
    kitchen_color_warning: string;
    kitchen_color_late: string;
    kitchen_visible_category_ids: string[];
  }> {
    const businessId = this.resolveBusinessId(user);
    const rows = await this.prisma.appSetting.findMany({
      where: { businessId, key: { in: KITCHEN_STAGE_KEYS } },
    });
    const config = new Map(rows.map((r) => [r.key, r.value]));
    const kitchenVisibleCategoryIds = await this.resolveVisibleCategoryIds(businessId, config);

    return {
      kitchen_stage_warning_minutes: parseInt(
        config.get('kitchen_stage_warning_minutes') ??
          String(KITCHEN_STAGE_DEFAULTS.kitchen_stage_warning_minutes),
        10,
      ),
      kitchen_late_threshold_minutes: parseInt(
        config.get('kitchen_late_threshold_minutes') ??
          String(KITCHEN_STAGE_DEFAULTS.kitchen_late_threshold_minutes),
        10,
      ),
      kitchen_color_fresh:
        config.get('kitchen_color_fresh') ??
        KITCHEN_STAGE_DEFAULTS.kitchen_color_fresh,
      kitchen_color_warning:
        config.get('kitchen_color_warning') ??
        KITCHEN_STAGE_DEFAULTS.kitchen_color_warning,
      kitchen_color_late:
        config.get('kitchen_color_late') ??
        KITCHEN_STAGE_DEFAULTS.kitchen_color_late,
      kitchen_visible_category_ids: kitchenVisibleCategoryIds,
    };
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

  // Usado por el POS/Mesero para saber si mostrar el campo "mesa" al cobrar.
  // No RolesGuard en el controller, mismo criterio que isStockTrackingEnabled.
  async isPosTableNumberEnabled(user: CurrentUserPayload): Promise<boolean> {
    const businessId = this.resolveBusinessId(user);
    const row = await this.prisma.appSetting.findUnique({
      where: {
        businessId_key: { businessId, key: 'pos_enable_table_number' },
      },
    });
    return row?.value === 'true';
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

  // Same "first business" pattern as getRawSettingsForFirstBusiness, but for
  // the bot token — that field moved out of app_settings into
  // TelegramBotConfig (Fase 2, plan-integracion-telegram.md), which
  // getRawSettingsForFirstBusiness can no longer see.
  async getFirstBusinessBotToken(): Promise<string> {
    const business = await this.prisma.business.findFirst();
    if (!business) return '';
    const config = await this.prisma.telegramBotConfig.findUnique({
      where: { businessId: business.id },
    });
    return config?.botToken ?? '';
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
    user: CurrentUserPayload,
    dto: TestTelegramDto,
  ): Promise<{ ok: boolean; message?: string; error?: string }> {
    // GET /settings returns the token masked (e.g. "123456***def") — if the
    // admin never edited the field before hitting "Probar conexión", dto
    // carries that masked placeholder, not a real token. Resolve the actual
    // stored token in that case instead of sending the placeholder to
    // Telegram's API (which always rejects it).
    let botToken = dto.telegram_bot_token;
    if (botToken.includes('***')) {
      const businessId = this.resolveBusinessId(user);
      const existing = await this.prisma.telegramBotConfig.findUnique({ where: { businessId } });
      botToken = existing?.botToken ?? '';
    }
    if (!botToken) {
      return { ok: false, error: 'No hay un token guardado para probar — ingresá uno nuevo.' };
    }

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
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

  // Si el negocio ya guardó kitchen_visible_category_ids explícitamente, se
  // usa eso. Si no (negocio que nunca tocó el nuevo selector), se deriva del
  // modo binario legado para no resetear en silencio el filtro de cocina de
  // quien ya tenía "solo pizzas" activo antes de esta migración.
  private async resolveVisibleCategoryIds(
    businessId: string,
    config: Map<string, string>,
  ): Promise<string[]> {
    const stored = config.get('kitchen_visible_category_ids');
    if (stored !== undefined) {
      try {
        return JSON.parse(stored) as string[];
      } catch {
        return [];
      }
    }

    const legacy = await this.prisma.appSetting.findUnique({
      where: {
        businessId_key: { businessId, key: LEGACY_KITCHEN_DISPLAY_MODE_KEY },
      },
    });
    if (legacy?.value !== 'pizzas_only') return [];

    const pizzaCategory = await this.prisma.category.findFirst({
      where: { businessId, isPizza: true },
      select: { id: true },
    });
    return pizzaCategory ? [pizzaCategory.id] : [];
  }

  private maskToken(token: string): string {
    if (!token || token.length < 10) return token;
    return token.slice(0, 6) + '***' + token.slice(-3);
  }
}
