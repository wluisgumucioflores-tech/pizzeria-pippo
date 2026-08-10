import { TelegramAiService } from './telegram-ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ReportsService } from '../reports/reports.service';
import { StockService } from '../stock/stock.service';
import { AiProviderFactory } from './ai-providers/ai-provider.factory';

describe('TelegramAiService', () => {
  let prisma: { branch: { findMany: jest.Mock }; promotion: { findMany: jest.Mock }; business: { findFirst: jest.Mock } };
  let settingsService: { getRawSettingsForFirstBusiness: jest.Mock };
  let reportsService: { getSales: jest.Mock; getTopProducts: jest.Mock; getOrders: jest.Mock };
  let stockService: { list: jest.Mock; getAlerts: jest.Mock };
  let aiProviderFactory: { resolve: jest.Mock };
  let service: TelegramAiService;

  const mockAiClient = { complete: jest.fn() };

  beforeEach(() => {
    prisma = {
      branch: { findMany: jest.fn().mockResolvedValue([]) },
      promotion: { findMany: jest.fn() },
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'biz1' }) },
    };
    settingsService = { getRawSettingsForFirstBusiness: jest.fn() };
    reportsService = { getSales: jest.fn(), getTopProducts: jest.fn(), getOrders: jest.fn() };
    stockService = { list: jest.fn(), getAlerts: jest.fn() };
    aiProviderFactory = { resolve: jest.fn().mockReturnValue(mockAiClient) };
    mockAiClient.complete.mockReset();

    service = new TelegramAiService(
      prisma as unknown as PrismaService,
      settingsService as unknown as SettingsService,
      reportsService as unknown as ReportsService,
      stockService as unknown as StockService,
      aiProviderFactory as unknown as AiProviderFactory,
    );
  });

  it('avisa que falta configuración si no hay API key para ningún proveedor', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({});

    const result = await service.processMessage('¿cuánto vendí hoy?');

    expect(result).toEqual({ type: 'text', content: '❌ El bot de IA no está configurado. Falta la API key del proveedor de IA.' });
    expect(aiProviderFactory.resolve).not.toHaveBeenCalled();
  });

  it('responde con mensaje de error si la IA devuelve algo que no es JSON válido', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ ai_provider: 'anthropic', anthropic_api_key: 'key' });
    mockAiClient.complete.mockResolvedValue('no soy json');

    const result = await service.processMessage('hola');

    expect(result.content).toContain('No pude entender tu mensaje');
  });

  it('despacha sales_summary a ReportsService.getSales y formatea el resultado', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ ai_provider: 'anthropic', anthropic_api_key: 'key' });
    mockAiClient.complete.mockResolvedValue(JSON.stringify({ intent: 'sales_summary', params: { from: '2026-07-14', to: '2026-07-14' } }));
    reportsService.getSales.mockResolvedValue({ total: 150.5, count: 3, avg: 50.16666 });

    const result = await service.processMessage('¿cuánto vendí hoy?');

    expect(reportsService.getSales).toHaveBeenCalledWith(
      { branchId: undefined, from: '2026-07-14', to: '2026-07-14' },
      expect.objectContaining({ business_id: 'biz1' }),
    );
    expect(result.content).toContain('Bs 150.50');
    expect(result.content).toContain('Órdenes: 3');
  });

  it('despacha stock_alerts a StockService.getAlerts y avisa cuando todo está bien', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ ai_provider: 'anthropic', anthropic_api_key: 'key' });
    mockAiClient.complete.mockResolvedValue(JSON.stringify({ intent: 'stock_alerts', params: {} }));
    stockService.getAlerts.mockResolvedValue([]);

    const result = await service.processMessage('¿hay algo bajo mínimo?');

    expect(result).toEqual({ type: 'text', content: '✅ Todo el stock está sobre el mínimo.' });
  });

  it('filtra stock_query por ingredient_name sobre los datos de StockService.list', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ ai_provider: 'anthropic', anthropic_api_key: 'key' });
    mockAiClient.complete.mockResolvedValue(
      JSON.stringify({ intent: 'stock_query', params: { ingredient_name: 'queso' } }),
    );
    stockService.list.mockResolvedValue({
      data: [
        { quantity: 5, min_quantity: 1, ingredients: { name: 'Queso Mozzarella', unit: 'kg' }, branches: { name: 'Satelite' } },
        { quantity: 2, min_quantity: 1, ingredients: { name: 'Harina', unit: 'kg' }, branches: { name: 'Satelite' } },
      ],
      total: 2,
      page: 1,
      pageSize: 9999,
    });

    const result = await service.processMessage('¿cuánto queso tengo?');

    expect(result.content).toContain('Queso Mozzarella');
    expect(result.content).not.toContain('Harina');
  });

  it('devuelve intent unknown como mensaje genérico', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ ai_provider: 'anthropic', anthropic_api_key: 'key' });
    mockAiClient.complete.mockResolvedValue(JSON.stringify({ intent: 'unknown', params: {} }));

    const result = await service.processMessage('¿qué tiempo hace?');

    expect(result.content).toContain('Solo puedo ayudarte con información del restaurante');
  });
});
