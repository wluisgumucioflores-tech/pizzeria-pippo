import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ReportsService } from '../reports/reports.service';
import { StockService } from '../stock/stock.service';
import { AiProviderFactory } from './ai-providers/ai-provider.factory';
import type { AiProviderName } from './ai-providers/ai-provider.factory';
import type { AiCompletionConfig } from './ai-providers/ai-completion-config.types';
import { buildSystemPrompt } from './lib/build-system-prompt';
import { todayInBolivia } from '../common/utils/timezone';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { TelegramAiParams, TelegramAiResult, TelegramResponse } from './types/telegram-ai.types';

const SETTINGS_KEYS = [
  'ai_provider',
  'anthropic_api_key',
  'openai_compatible_api_key',
  'openai_compatible_base_url',
  'telegram_ai_model',
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function toDisplayDate(isoDate: string): string {
  return isoDate.split('-').reverse().join('/');
}

function dateLabel(from: string, to: string): string {
  return from === to ? toDisplayDate(from) : `${toDisplayDate(from)} al ${toDisplayDate(to)}`;
}

@Injectable()
export class TelegramAiService {
  private readonly logger = new Logger(TelegramAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly reportsService: ReportsService,
    private readonly stockService: StockService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  async processMessage(userMessage: string): Promise<TelegramResponse> {
    const settings = await this.settingsService.getRawSettingsForFirstBusiness(SETTINGS_KEYS);
    const resolved = this.resolveProviderConfig(settings);
    if (!resolved) {
      return { type: 'text', content: '❌ El bot de IA no está configurado. Falta la API key del proveedor de IA.' };
    }

    const today = todayInBolivia();
    const branches = await this.resolveBranches();

    let aiResult: TelegramAiResult;
    try {
      const client = this.aiProviderFactory.resolve(resolved.provider);
      const text = await client.complete(resolved.config, buildSystemPrompt(today, branches), userMessage);
      aiResult = JSON.parse(text) as TelegramAiResult;
    } catch (err) {
      this.logger.error('processMessage error', err);
      return { type: 'text', content: 'No pude entender tu mensaje. Intentá con una pregunta sobre ventas, stock o promociones.' };
    }

    const { intent, params } = aiResult;

    switch (intent) {
      case 'stock_query':
        return { type: 'text', content: await this.handleStockQuery(params) };
      case 'stock_alerts':
        return { type: 'text', content: await this.handleStockAlerts(params) };
      case 'sales_summary':
      case 'daily_orders':
        return { type: 'text', content: await this.handleSalesSummary(params) };
      case 'top_products':
        return { type: 'text', content: await this.handleTopProducts(params) };
      case 'promotions_query':
        return { type: 'text', content: await this.handlePromotionsQuery(params) };
      case 'sales_report_excel':
        return await this.handleSalesExcel(params);
      default:
        return {
          type: 'text',
          content: 'Solo puedo ayudarte con información del restaurante: ventas, stock, reportes y promociones. ¿En qué te puedo ayudar?',
        };
    }
  }

  // Same "first business" pattern as SettingsService.getRawSettingsForFirstBusiness:
  // the Telegram bot has no user JWT, and only one business exists today, so a
  // synthetic admin payload scoped to that business stands in for a real user
  // when calling services that require CurrentUserPayload for tenant scoping.
  private async resolveFirstBusinessUser(): Promise<CurrentUserPayload> {
    const business = await this.prisma.business.findFirst();
    return {
      id: 'telegram-bot',
      email: '',
      role: 'admin',
      branch_id: null,
      full_name: null,
      business_id: business?.id ?? null,
    };
  }

  private async resolveBranches(): Promise<{ id: string; name: string }[]> {
    return this.prisma.branch.findMany({ select: { id: true, name: true } });
  }

  private resolveProviderConfig(
    settings: Record<string, string>,
  ): { provider: AiProviderName; config: AiCompletionConfig } | null {
    const provider = (settings['ai_provider'] || 'anthropic') as AiProviderName;

    if (provider === 'anthropic') {
      const apiKey = settings['anthropic_api_key'] || process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) return null;
      return { provider, config: { apiKey, model: settings['telegram_ai_model'] || 'claude-haiku-4-5-20251001' } };
    }

    const apiKey = settings['openai_compatible_api_key'] || process.env.OPENAI_COMPATIBLE_API_KEY || '';
    if (!apiKey) return null;
    return {
      provider,
      config: {
        apiKey,
        model: settings['telegram_ai_model'] || 'qwen-plus',
        baseURL: settings['openai_compatible_base_url'] || process.env.OPENAI_COMPATIBLE_BASE_URL || undefined,
      },
    };
  }

  private async handleStockQuery(params: TelegramAiParams): Promise<string> {
    const user = await this.resolveFirstBusinessUser();
    const { data } = await this.stockService.list({ branchId: params.branch_id, page: 1, pageSize: 9999 }, user);
    const rows = params.ingredient_name
      ? data.filter((r) => r.ingredients.name.toLowerCase().includes(params.ingredient_name!.toLowerCase()))
      : data;

    if (!rows.length) return 'No se encontraron registros de stock.';

    const byBranch: Record<string, typeof rows> = {};
    for (const row of rows) {
      (byBranch[row.branches.name] ??= []).push(row);
    }

    const today = toDisplayDate(todayInBolivia());
    return Object.entries(byBranch)
      .map(([branch, branchRows]) => {
        const lines = branchRows
          .map((r) => {
            const warn = r.quantity < r.min_quantity ? ' ⚠️' : '';
            return `• ${r.ingredients.name}: ${r.quantity} ${r.ingredients.unit}${warn}`;
          })
          .join('\n');
        return `📦 *Stock actual — ${branch}*\n\n${lines}\n\n_Consultado el ${today}_`;
      })
      .join('\n\n---\n\n');
  }

  private async handleStockAlerts(params: TelegramAiParams): Promise<string> {
    const user = await this.resolveFirstBusinessUser();
    const alerts = await this.stockService.getAlerts({ branchId: params.branch_id }, user);
    if (!alerts.length) return '✅ Todo el stock está sobre el mínimo.';

    const byBranch: Record<string, typeof alerts> = {};
    for (const row of alerts) {
      (byBranch[row.branches.name] ??= []).push(row);
    }

    return Object.entries(byBranch)
      .map(([branch, rows]) => {
        const lines = rows
          .map((r) => `• ${r.ingredients.name}: ${r.quantity} ${r.ingredients.unit} (mínimo: ${r.min_quantity} ${r.ingredients.unit})`)
          .join('\n');
        return `⚠️ *Stock bajo — ${branch}*\n\n${lines}`;
      })
      .join('\n\n');
  }

  private async handleSalesSummary(params: TelegramAiParams): Promise<string> {
    const from = params.from ?? todayInBolivia();
    const to = params.to ?? todayInBolivia();
    const user = await this.resolveFirstBusinessUser();
    const { total, count, avg } = await this.reportsService.getSales({ branchId: params.branch_id, from, to }, user);

    return `💰 *Ventas — ${dateLabel(from, to)}*\n\nTotal vendido: Bs ${total.toFixed(2)}\nÓrdenes: ${count}\nTicket promedio: Bs ${avg.toFixed(2)}`;
  }

  private async handleTopProducts(params: TelegramAiParams): Promise<string> {
    const from = params.from ?? todayInBolivia();
    const to = params.to ?? todayInBolivia();
    const user = await this.resolveFirstBusinessUser();
    const products = await this.reportsService.getTopProducts({ branchId: params.branch_id, from, to }, user);

    if (!products.length) return 'No hubo ventas en ese período.';

    const lines = products
      .slice(0, 10)
      .map((p, i) => `${i + 1}. ${p.product_name} (${p.variant_name}): ${p.qty} uds`)
      .join('\n');

    return `🏆 *Productos más vendidos — ${dateLabel(from, to)}*\n\n${lines}`;
  }

  private async handlePromotionsQuery(params: TelegramAiParams): Promise<string> {
    const today = new Date(todayInBolivia());
    const user = await this.resolveFirstBusinessUser();
    const promotions = await this.prisma.promotion.findMany({
      where: {
        businessId: user.business_id ?? undefined,
        startDate: { lte: today },
        endDate: { gte: today },
        ...(params.branch_id && { branchId: params.branch_id }),
      },
      select: { name: true, type: true, daysOfWeek: true },
    });

    if (!promotions.length) return 'No hay promociones activas hoy.';

    const lines = promotions
      .map((p) => {
        const days = p.daysOfWeek.map((d) => DAY_NAMES[d]).join(', ');
        return `• ${p.name} (${p.type}) — ${days || 'todos los días'}`;
      })
      .join('\n');

    return `🎁 *Promociones activas hoy*\n\n${lines}`;
  }

  private async handleSalesExcel(params: TelegramAiParams): Promise<TelegramResponse> {
    const from = params.from ?? todayInBolivia();
    const to = params.to ?? todayInBolivia();
    const user = await this.resolveFirstBusinessUser();
    const { data: allOrders } = await this.reportsService.getOrders(
      { branchId: params.branch_id, from, to, page: 1, pageSize: 9999 },
      user,
    );
    const orders = allOrders.filter((o) => !o.cancelled_at);

    if (!orders.length) return { type: 'text', content: 'No hay ventas en ese período.' };

    const rows: (string | number)[][] = [['#', 'Sucursal', 'Fecha', 'Tipo', 'Pago', 'Total (Bs)', 'Productos']];

    for (const order of orders) {
      const products = order.order_items
        .map((i) => `${i.product_variants?.products?.name ?? '?'} ${i.product_variants?.name ?? ''} x${i.qty}`)
        .join(', ');
      const date = new Date(order.created_at).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' });
      rows.push([
        order.daily_number ?? '',
        order.branches?.name ?? '',
        date,
        order.order_type === 'dine_in' ? 'Local' : 'Para llevar',
        order.payment_method ?? '',
        order.total.toFixed(2),
        products,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const label = from === to ? from : `${from}_al_${to}`;
    return { type: 'file', content: buffer, filename: `ventas_${label}.xlsx` };
  }
}
