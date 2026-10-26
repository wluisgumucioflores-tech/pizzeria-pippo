import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  DEFAULT_ONLINE_MENU_MODE,
  DEFAULT_ONLINE_ORDERS_EXPIRE_MINUTES,
  ONLINE_MENU_MODES,
  type OnlineMenuMode,
} from '@pippo/shared';
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
  'stock_deduct_resale',
  'stock_deduct_insumos',
  'stock_deduct_made_unit',
  'online_orders_whatsapp',
  'online_orders_expire_minutes',
  'online_menu_mode',
  'online_menu_category_ids',
  'online_menu_product_ids',
];

// Public QR ordering (see docs/features/pedidos-online-qr/). Only read/written
// when the business has the onlineOrders module on — the keys are stored
// regardless, so turning the module off and back on doesn't lose the config.
const ONLINE_ORDERS_DEFAULTS = {
  online_orders_whatsapp: '',
  online_orders_expire_minutes: DEFAULT_ONLINE_ORDERS_EXPIRE_MINUTES,
  online_menu_mode: DEFAULT_ONLINE_MENU_MODE,
};

// Read on their own by the public QR endpoints (getOnlineOrdersConfig), which
// have no user and don't need the other 13 settings.
const ONLINE_ORDERS_SETTING_KEYS = [
  'online_orders_whatsapp',
  'online_orders_expire_minutes',
  'online_menu_mode',
  'online_menu_category_ids',
  'online_menu_product_ids',
];

// Sub-controls of use_stock (Configuración → Inventario), business-wide —
// not per-product (see docs/features/jefe-produccion/feature.md, "Control
// de inventario"). stock_deduct_made_unit only has effect if the business
// currently has the 'produccion' module enabled (immediate cutoff if the
// superadmin disables it later — see getStockControlFlags).
const STOCK_CONTROL_DEFAULTS = {
  stock_deduct_resale: true,
  stock_deduct_insumos: true,
  stock_deduct_made_unit: false,
};

// The four stock keys OrdersService needs on every single sale. They used to
// cost two separate uncached queries per sale (use_stock, then the three
// stock_deduct_* flags) for values that change a handful of times a year, so
// they are read together and cached per business.
const STOCK_SETTING_KEYS = [
  'use_stock',
  'stock_deduct_resale',
  'stock_deduct_insumos',
  'stock_deduct_made_unit',
];

// Short TTL rather than pure invalidation, because the backend can run as more
// than one instance: an admin saving Configuración only invalidates the cache
// of the instance that served the request, so the others must expire on their
// own. 30s is well under the time it takes an admin to switch screens and
// check, while still removing the queries from the sale path.
const STOCK_SETTINGS_TTL_MS = 30_000;

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

  private readonly stockSettingsCache = new Map<
    string,
    { expiresAt: number; values: Map<string, string> }
  >();

  // Raw stored values only — no module crossing or defaults applied here, so
  // the cached entry stays independent of the requesting user (enabled_modules
  // is per-request and must be re-evaluated on every call, see
  // getStockControlFlags).
  private async loadStockSettings(
    businessId: string,
  ): Promise<Map<string, string>> {
    const cached = this.stockSettingsCache.get(businessId);
    if (cached && cached.expiresAt > Date.now()) return cached.values;

    const rows = await this.prisma.appSetting.findMany({
      where: { businessId, key: { in: STOCK_SETTING_KEYS } },
    });
    const values = new Map(rows.map((r) => [r.key, r.value]));
    this.stockSettingsCache.set(businessId, {
      expiresAt: Date.now() + STOCK_SETTINGS_TTL_MS,
      values,
    });
    return values;
  }

  private invalidateStockSettings(businessId: string): void {
    this.stockSettingsCache.delete(businessId);
  }

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
      stock_deduct_resale:
        config.get('stock_deduct_resale') !== 'false',
      stock_deduct_insumos:
        config.get('stock_deduct_insumos') !== 'false',
      stock_deduct_made_unit:
        config.get('stock_deduct_made_unit') === 'true',
      online_orders_whatsapp:
        config.get('online_orders_whatsapp')?.trim() ??
        ONLINE_ORDERS_DEFAULTS.online_orders_whatsapp,
      online_orders_expire_minutes: parseInt(
        config.get('online_orders_expire_minutes') ??
          String(ONLINE_ORDERS_DEFAULTS.online_orders_expire_minutes),
        10,
      ),
      online_menu_mode: this.parseOnlineMenuMode(
        config.get('online_menu_mode'),
      ),
      online_menu_category_ids: this.parseIdList(
        config.get('online_menu_category_ids'),
      ),
      online_menu_product_ids: this.parseIdList(
        config.get('online_menu_product_ids'),
      ),
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
      [
        'stock_deduct_resale',
        String(dto.stock_deduct_resale ?? STOCK_CONTROL_DEFAULTS.stock_deduct_resale),
      ],
      [
        'stock_deduct_insumos',
        String(dto.stock_deduct_insumos ?? STOCK_CONTROL_DEFAULTS.stock_deduct_insumos),
      ],
      [
        'stock_deduct_made_unit',
        String(dto.stock_deduct_made_unit ?? STOCK_CONTROL_DEFAULTS.stock_deduct_made_unit),
      ],
      [
        'online_orders_whatsapp',
        dto.online_orders_whatsapp?.trim() ??
          ONLINE_ORDERS_DEFAULTS.online_orders_whatsapp,
      ],
      [
        'online_orders_expire_minutes',
        String(
          dto.online_orders_expire_minutes ??
            ONLINE_ORDERS_DEFAULTS.online_orders_expire_minutes,
        ),
      ],
      [
        'online_menu_mode',
        dto.online_menu_mode ?? ONLINE_ORDERS_DEFAULTS.online_menu_mode,
      ],
      [
        'online_menu_category_ids',
        JSON.stringify(dto.online_menu_category_ids ?? []),
      ],
      [
        'online_menu_product_ids',
        JSON.stringify(dto.online_menu_product_ids ?? []),
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

    this.invalidateStockSettings(businessId);
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
    const values = await this.loadStockSettings(businessId);
    return values.get('use_stock') !== 'false';
  }

  // Used by OrdersService when computing stock deductions (sale/cancellation) —
  // business-wide sub-controls of use_stock, not per-product. Only read once
  // isStockTrackingEnabled already returned true; the caller doesn't need to
  // call this if the business has stock tracking off entirely.
  // stock_deduct_made_unit is crossed here with enabled_modules.produccion —
  // immediate cutoff if the superadmin disables the module after someone
  // already turned the switch on (same criteria as the rest of the feature).
  async getStockControlFlags(user: CurrentUserPayload): Promise<{
    resale: boolean;
    insumos: boolean;
    madeUnit: boolean;
  }> {
    const businessId = this.resolveBusinessId(user);
    const config = await this.loadStockSettings(businessId);
    const madeUnitRaw = config.get('stock_deduct_made_unit') === 'true';

    return {
      resale: config.get('stock_deduct_resale') !== 'false',
      insumos: config.get('stock_deduct_insumos') !== 'false',
      madeUnit: madeUnitRaw && user.enabled_modules.produccion,
    };
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

    // Defensive: this generic writer is used for the Telegram/AI keys today,
    // but nothing stops a stock key being saved through it.
    if (updates.some(({ key }) => STOCK_SETTING_KEYS.includes(key))) {
      this.invalidateStockSettings(businessId);
    }
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

  // businessId variant of isStockTrackingEnabled, for the public QR menu —
  // which has no JWT and still needs to know whether to hide resale products
  // that are out of stock. Shares the same cache.
  async isStockTrackingEnabledForBusiness(businessId: string): Promise<boolean> {
    const values = await this.loadStockSettings(businessId);
    return values.get('use_stock') !== 'false';
  }

  // Resolved by businessId instead of a user, because the public QR endpoints
  // have no JWT at all — the business comes from the branch in the scanned
  // URL. Same "no user context" need the Telegram webhook already had, but
  // properly multi-tenant rather than "the first business that exists".
  async getOnlineOrdersConfig(businessId: string): Promise<{
    whatsapp: string;
    expireMinutes: number;
    menuMode: OnlineMenuMode;
    categoryIds: string[];
    productIds: string[];
  }> {
    const rows = await this.prisma.appSetting.findMany({
      where: { businessId, key: { in: ONLINE_ORDERS_SETTING_KEYS } },
    });
    const config = new Map(rows.map((r) => [r.key, r.value]));

    return {
      whatsapp:
        config.get('online_orders_whatsapp')?.trim() ??
        ONLINE_ORDERS_DEFAULTS.online_orders_whatsapp,
      expireMinutes: parseInt(
        config.get('online_orders_expire_minutes') ??
          String(ONLINE_ORDERS_DEFAULTS.online_orders_expire_minutes),
        10,
      ),
      menuMode: this.parseOnlineMenuMode(config.get('online_menu_mode')),
      categoryIds: this.parseIdList(config.get('online_menu_category_ids')),
      productIds: this.parseIdList(config.get('online_menu_product_ids')),
    };
  }

  // Stored as a JSON array of uuids, same shape as
  // kitchen_visible_category_ids. A malformed/hand-edited row degrades to an
  // empty list rather than throwing on every settings read.
  private parseIdList(stored: string | undefined): string[] {
    if (!stored) return [];
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
      return [];
    }
  }

  private parseOnlineMenuMode(stored: string | undefined): OnlineMenuMode {
    return ONLINE_MENU_MODES.includes(stored as OnlineMenuMode)
      ? (stored as OnlineMenuMode)
      : DEFAULT_ONLINE_MENU_MODE;
  }

  private maskToken(token: string): string {
    if (!token || token.length < 10) return token;
    return token.slice(0, 6) + '***' + token.slice(-3);
  }
}
