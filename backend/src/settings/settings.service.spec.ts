import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    appSetting: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    telegramBotConfig: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    business: { findFirst: jest.Mock };
  };

  const admin: CurrentUserPayload = {
    id: 'u1',
    email: 'admin@pippo.local',
    role: 'admin',
    branch_id: null,
    full_name: 'Admin',
    business_id: 'biz1',
    enabled_modules: DEFAULT_ENABLED_MODULES,
  };
  const adminSinNegocio: CurrentUserPayload = {
    id: 'u2',
    email: 'sinnegocio@pippo.local',
    role: 'admin',
    branch_id: null,
    full_name: 'Sin negocio',
    business_id: null,
    enabled_modules: DEFAULT_ENABLED_MODULES,
  };

  beforeEach(async () => {
    prisma = {
      appSetting: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      telegramBotConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      business: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  describe('getSettings', () => {
    it('aplica defaults cuando no hay fila de telegram y enmascara el token', async () => {
      prisma.appSetting.findMany.mockResolvedValue([]);
      prisma.telegramBotConfig.findUnique.mockResolvedValue({
        botToken: '123456789abcdef',
        chatId: '',
        notificationsEnabled: false,
      });

      const result = await service.getSettings(admin);

      expect(prisma.telegramBotConfig.findUnique).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
      });
      expect(result).toEqual({
        telegram_bot_token: '123456***def',
        telegram_chat_id: '',
        telegram_enabled: false,
        chat_ia_enabled: false,
        kitchen_stage_warning_minutes: 7,
        kitchen_late_threshold_minutes: 10,
        kitchen_visible_category_ids: [],
        kitchen_color_fresh: '#16a34a',
        kitchen_color_warning: '#d97706',
        kitchen_color_late: '#dc2626',
        printer_paper_width: 58,
        printer_business_name: 'GU PIZZA',
        use_stock: true,
        pos_enable_table_number: false,
        stock_deduct_resale: true,
        stock_deduct_insumos: true,
        stock_deduct_made_unit: false,
        online_orders_whatsapp: '',
        online_orders_expire_minutes: 30,
        online_menu_mode: 'all',
        online_menu_category_ids: [],
        online_menu_product_ids: [],
      });
    });

    it('devuelve telegram vacío/deshabilitado si el negocio nunca configuró un bot', async () => {
      prisma.appSetting.findMany.mockResolvedValue([]);
      prisma.telegramBotConfig.findUnique.mockResolvedValue(null);

      const result = await service.getSettings(admin);

      expect(result.telegram_bot_token).toBe('');
      expect(result.telegram_chat_id).toBe('');
      expect(result.telegram_enabled).toBe(false);
    });

    it('lanza si el usuario no tiene business_id', async () => {
      await expect(service.getSettings(adminSinNegocio)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('updateSettings', () => {
    it('no sobreescribe el token si viene enmascarado, pero sí actualiza chat_id/enabled', async () => {
      prisma.telegramBotConfig.findUnique.mockResolvedValue({
        businessId: 'biz1',
        botToken: 'token-existente',
        chatId: 'chat-viejo',
        notificationsEnabled: false,
      });

      await service.updateSettings(admin, {
        telegram_bot_token: '123456***def',
        telegram_chat_id: 'chat1',
        telegram_enabled: true,
        kitchen_late_threshold_minutes: 15,
        printer_paper_width: 80,
      });

      const keysUpserted = prisma.appSetting.upsert.mock.calls.map(
        (call) => call[0].where.businessId_key.key,
      );
      expect(keysUpserted).not.toContain('telegram_bot_token');
      expect(keysUpserted).not.toContain('telegram_chat_id');
      expect(keysUpserted).toEqual(
        expect.arrayContaining([
          'kitchen_late_threshold_minutes',
          'printer_paper_width',
          'printer_business_name',
        ]),
      );
      expect(prisma.telegramBotConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          update: expect.objectContaining({ chatId: 'chat1', notificationsEnabled: true }),
        }),
      );
      const updateArg = prisma.telegramBotConfig.upsert.mock.calls[0][0].update;
      expect(updateArg.botToken).toBeUndefined();
    });

    it('sí actualiza el token si viene un valor nuevo sin enmascarar', async () => {
      prisma.telegramBotConfig.findUnique.mockResolvedValue({
        businessId: 'biz1',
        botToken: 'token-viejo',
        chatId: 'chat1',
        notificationsEnabled: true,
      });

      await service.updateSettings(admin, {
        telegram_bot_token: 'nuevo-token-real',
        telegram_chat_id: 'chat1',
        telegram_enabled: true,
        kitchen_late_threshold_minutes: 15,
        printer_paper_width: 58,
      });

      const upsertCall = prisma.telegramBotConfig.upsert.mock.calls[0][0];
      expect(upsertCall.update.botToken).toBe('nuevo-token-real');
    });

    it('no crea una fila de telegram si el negocio nunca configuró un bot y guarda otra pestaña', async () => {
      prisma.telegramBotConfig.findUnique.mockResolvedValue(null);

      await service.updateSettings(admin, {
        telegram_chat_id: '',
        telegram_enabled: false,
        kitchen_late_threshold_minutes: 15,
        printer_paper_width: 58,
      });

      expect(prisma.telegramBotConfig.upsert).not.toHaveBeenCalled();
    });

    it('crea la fila de telegram cuando llega un token real por primera vez', async () => {
      prisma.telegramBotConfig.findUnique.mockResolvedValue(null);

      await service.updateSettings(admin, {
        telegram_bot_token: 'primer-token',
        telegram_chat_id: 'chat-nuevo',
        telegram_enabled: true,
        kitchen_late_threshold_minutes: 15,
        printer_paper_width: 58,
      });

      expect(prisma.telegramBotConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          create: expect.objectContaining({
            businessId: 'biz1',
            botToken: 'primer-token',
            chatId: 'chat-nuevo',
            notificationsEnabled: true,
            chatIaEnabled: false,
          }),
        }),
      );
    });

    describe('chat_ia_enabled — activación de webhook', () => {
      const originalEnv = process.env.BACKEND_PUBLIC_URL;

      beforeEach(() => {
        process.env.BACKEND_PUBLIC_URL = 'https://backend.example.com';
        prisma.telegramBotConfig.findUnique.mockResolvedValue({
          businessId: 'biz1',
          botToken: 'token-real',
          chatId: 'chat1',
          notificationsEnabled: true,
          chatIaEnabled: false,
          webhookToken: null,
          webhookSecret: null,
        });
      });

      afterEach(() => {
        process.env.BACKEND_PUBLIC_URL = originalEnv;
      });

      it('NO persiste chat_ia_enabled si Telegram rechaza el webhook (bug: quedaba "prendido" en la BD sin webhook real)', async () => {
        global.fetch = jest
          .fn()
          .mockResolvedValue({ json: () => Promise.resolve({ ok: false, description: 'Bad Request' }) }) as unknown as typeof fetch;

        await expect(
          service.updateSettings(admin, {
            telegram_chat_id: 'chat1',
            telegram_enabled: true,
            chat_ia_enabled: true,
            kitchen_late_threshold_minutes: 15,
            printer_paper_width: 58,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.telegramBotConfig.upsert).not.toHaveBeenCalled();
      });

      it('persiste chat_ia_enabled solo después de que Telegram confirma el webhook', async () => {
        global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true }) }) as unknown as typeof fetch;

        await service.updateSettings(admin, {
          telegram_chat_id: 'chat1',
          telegram_enabled: true,
          chat_ia_enabled: true,
          kitchen_late_threshold_minutes: 15,
          printer_paper_width: 58,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/setWebhook'),
          expect.anything(),
        );
        expect(prisma.telegramBotConfig.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ update: expect.objectContaining({ chatIaEnabled: true }) }),
        );
      });
    });

    it('normaliza printer_paper_width a 58 si no es 80', async () => {
      await service.updateSettings(admin, {
        telegram_chat_id: '',
        telegram_enabled: false,
        kitchen_late_threshold_minutes: 10,
        printer_paper_width: 999,
      });

      const paperCall = prisma.appSetting.upsert.mock.calls.find(
        (call) => call[0].where.businessId_key.key === 'printer_paper_width',
      );
      expect(paperCall[0].create.value).toBe('58');
    });

    it('guarda el nombre comercial de los tickets', async () => {
      await service.updateSettings(admin, {
        telegram_chat_id: '',
        telegram_enabled: false,
        kitchen_late_threshold_minutes: 10,
        printer_paper_width: 58,
        printer_business_name: 'Pizza del Barrio',
      });

      const businessNameCall = prisma.appSetting.upsert.mock.calls.find(
        (call) => call[0].where.businessId_key.key === 'printer_business_name',
      );
      expect(businessNameCall[0].create.value).toBe('Pizza del Barrio');
      expect(businessNameCall[0].update.value).toBe('Pizza del Barrio');
    });
  });

  // Pedidos online por QR — ver docs/features/pedidos-online-qr/
  describe('configuración de pedidos online', () => {
    const upsertedValue = (key: string) => {
      const call = prisma.appSetting.upsert.mock.calls.find(
        (c) => c[0].where.businessId_key.key === key,
      );
      return call?.[0].create.value as string | undefined;
    };

    it('lee el modo de menú y las listas de ids guardadas', async () => {
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'online_menu_mode', value: 'categories' },
        { key: 'online_menu_category_ids', value: '["cat-1","cat-2"]' },
        { key: 'online_menu_product_ids', value: '["prod-1"]' },
        { key: 'online_orders_whatsapp', value: '+59170000000' },
        { key: 'online_orders_expire_minutes', value: '45' },
      ]);

      const result = await service.getSettings(admin);

      expect(result.online_menu_mode).toBe('categories');
      expect(result.online_menu_category_ids).toEqual(['cat-1', 'cat-2']);
      expect(result.online_menu_product_ids).toEqual(['prod-1']);
      expect(result.online_orders_whatsapp).toBe('+59170000000');
      expect(result.online_orders_expire_minutes).toBe(45);
    });

    // Una fila corrupta (editada a mano en la base) no debe tirar abajo TODA
    // la lectura de configuración — degrada a los defaults.
    it('degrada a los defaults si el modo o las listas están corruptos', async () => {
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'online_menu_mode', value: 'modo-inventado' },
        { key: 'online_menu_category_ids', value: 'no-es-json' },
        { key: 'online_menu_product_ids', value: '{"no":"es-un-array"}' },
      ]);

      const result = await service.getSettings(admin);

      expect(result.online_menu_mode).toBe('all');
      expect(result.online_menu_category_ids).toEqual([]);
      expect(result.online_menu_product_ids).toEqual([]);
    });

    it('guarda las cinco claves nuevas', async () => {
      await service.updateSettings(admin, {
        telegram_chat_id: '',
        telegram_enabled: false,
        kitchen_late_threshold_minutes: 10,
        printer_paper_width: 58,
        online_orders_whatsapp: '  +59171234567  ',
        online_orders_expire_minutes: 15,
        online_menu_mode: 'products',
        online_menu_category_ids: [],
        online_menu_product_ids: ['prod-1', 'prod-2'],
      });

      expect(upsertedValue('online_orders_whatsapp')).toBe('+59171234567');
      expect(upsertedValue('online_orders_expire_minutes')).toBe('15');
      expect(upsertedValue('online_menu_mode')).toBe('products');
      expect(upsertedValue('online_menu_product_ids')).toBe(
        '["prod-1","prod-2"]',
      );
    });

    // El frontend manda SIEMPRE el objeto entero de configuración, pero un
    // negocio que nunca abrió esta pestaña no tiene estos campos cargados:
    // guardar otra pestaña debe escribir los defaults, no 'undefined'.
    // Los endpoints públicos del QR no tienen JWT: resuelven el negocio desde
    // la sucursal de la URL, así que necesitan leer sin CurrentUserPayload.
    describe('getOnlineOrdersConfig — sin usuario', () => {
      it('lee solo las 5 claves de pedidos online, por businessId', async () => {
        prisma.appSetting.findMany.mockResolvedValue([
          { key: 'online_orders_whatsapp', value: '+59170000000' },
          { key: 'online_orders_expire_minutes', value: '20' },
          { key: 'online_menu_mode', value: 'products' },
          { key: 'online_menu_product_ids', value: '["p1"]' },
        ]);

        const config = await service.getOnlineOrdersConfig('biz1');

        expect(prisma.appSetting.findMany).toHaveBeenCalledWith({
          where: {
            businessId: 'biz1',
            key: {
              in: [
                'online_orders_whatsapp',
                'online_orders_expire_minutes',
                'online_menu_mode',
                'online_menu_category_ids',
                'online_menu_product_ids',
              ],
            },
          },
        });
        expect(config).toEqual({
          whatsapp: '+59170000000',
          expireMinutes: 20,
          menuMode: 'products',
          categoryIds: [],
          productIds: ['p1'],
        });
      });

      it('devuelve los defaults si el negocio nunca configuró nada', async () => {
        prisma.appSetting.findMany.mockResolvedValue([]);

        const config = await service.getOnlineOrdersConfig('biz1');

        expect(config).toEqual({
          whatsapp: '',
          expireMinutes: 30,
          menuMode: 'all',
          categoryIds: [],
          productIds: [],
        });
      });
    });

    it('escribe los defaults si el DTO no trae los campos de pedidos online', async () => {
      await service.updateSettings(admin, {
        telegram_chat_id: '',
        telegram_enabled: false,
        kitchen_late_threshold_minutes: 10,
        printer_paper_width: 58,
      });

      expect(upsertedValue('online_orders_whatsapp')).toBe('');
      expect(upsertedValue('online_orders_expire_minutes')).toBe('30');
      expect(upsertedValue('online_menu_mode')).toBe('all');
      expect(upsertedValue('online_menu_category_ids')).toBe('[]');
      expect(upsertedValue('online_menu_product_ids')).toBe('[]');
    });
  });

  describe('getRawSettings', () => {
    it('devuelve un mapa key -> value solo con las keys pedidas', async () => {
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'ai_provider', value: 'anthropic' },
        { key: 'telegram_ai_model', value: 'claude-haiku-4-5-20251001' },
      ]);

      const result = await service.getRawSettings(admin, [
        'ai_provider',
        'telegram_ai_model',
      ]);

      expect(prisma.appSetting.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz1',
          key: { in: ['ai_provider', 'telegram_ai_model'] },
        },
      });
      expect(result).toEqual({
        ai_provider: 'anthropic',
        telegram_ai_model: 'claude-haiku-4-5-20251001',
      });
    });
  });

  describe('getRawSettingsForFirstBusiness', () => {
    it('resuelve el business_id tomando el único negocio existente, sin usuario', async () => {
      prisma.business.findFirst.mockResolvedValue({ id: 'biz1' });
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'telegram_webhook_secret', value: 'shh' },
      ]);

      const result = await service.getRawSettingsForFirstBusiness([
        'telegram_webhook_secret',
      ]);

      expect(prisma.appSetting.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', key: { in: ['telegram_webhook_secret'] } },
      });
      expect(result).toEqual({ telegram_webhook_secret: 'shh' });
    });

    it('devuelve un objeto vacío si no existe ningún negocio', async () => {
      prisma.business.findFirst.mockResolvedValue(null);

      const result = await service.getRawSettingsForFirstBusiness([
        'telegram_webhook_secret',
      ]);

      expect(result).toEqual({});
      expect(prisma.appSetting.findMany).not.toHaveBeenCalled();
    });
  });

  describe('testTelegramConnection', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
      fetchMock = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });
      global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('resuelve el token real guardado si el que llega viene enmascarado (bug: Probar conexión tras recargar la página)', async () => {
      prisma.telegramBotConfig.findUnique.mockResolvedValue({ botToken: 'token-real-guardado' });

      await service.testTelegramConnection(admin, {
        telegram_bot_token: '123456***def',
        telegram_chat_id: 'chat1',
      });

      expect(prisma.telegramBotConfig.findUnique).toHaveBeenCalledWith({ where: { businessId: 'biz1' } });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken-real-guardado/sendMessage',
        expect.anything(),
      );
    });

    it('usa el token tal cual si no viene enmascarado', async () => {
      await service.testTelegramConnection(admin, {
        telegram_bot_token: 'token-nuevo-sin-guardar',
        telegram_chat_id: 'chat1',
      });

      expect(prisma.telegramBotConfig.findUnique).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken-nuevo-sin-guardar/sendMessage',
        expect.anything(),
      );
    });

    it('devuelve un error legible si el token viene enmascarado y no hay ninguno guardado', async () => {
      prisma.telegramBotConfig.findUnique.mockResolvedValue(null);

      const result = await service.testTelegramConnection(admin, {
        telegram_bot_token: '123456***def',
        telegram_chat_id: 'chat1',
      });

      expect(result).toEqual({ ok: false, error: expect.stringContaining('No hay un token guardado') });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('saveRawSettings', () => {
    it('hace upsert de cada entrada bajo el business_id del usuario', async () => {
      await service.saveRawSettings(admin, [
        { key: 'ai_provider', value: 'anthropic' },
        { key: 'telegram_ai_model', value: 'claude-haiku-4-5-20251001' },
      ]);

      expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId_key: { businessId: 'biz1', key: 'ai_provider' } },
          create: {
            businessId: 'biz1',
            key: 'ai_provider',
            value: 'anthropic',
          },
        }),
      );
    });
  });

  describe('getKitchenStageSettings', () => {
    it('cualquier usuario autenticado con business_id puede leerlo (fix del bug de RLS)', async () => {
      const cocinero: CurrentUserPayload = {
        id: 'u3',
        email: 'cocinero@pippo.local',
        role: 'cocinero',
        branch_id: 'b1',
        full_name: 'Cocinero',
        business_id: 'biz1',
        enabled_modules: DEFAULT_ENABLED_MODULES,
      };
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'kitchen_late_threshold_minutes', value: '20' },
      ]);

      const result = await service.getKitchenStageSettings(cocinero);

      expect(result.kitchen_late_threshold_minutes).toBe(20);
    });

    it('devuelve los defaults si no hay filas', async () => {
      prisma.appSetting.findMany.mockResolvedValue([]);

      const result = await service.getKitchenStageSettings(admin);

      expect(result).toEqual({
        kitchen_stage_warning_minutes: 7,
        kitchen_late_threshold_minutes: 10,
        kitchen_color_fresh: '#16a34a',
        kitchen_color_warning: '#d97706',
        kitchen_color_late: '#dc2626',
        kitchen_visible_category_ids: [],
      });
    });
  });

  describe('updateSettings — validación de etapas de cocina', () => {
    it('rechaza si el umbral ámbar no es menor que el rojo', async () => {
      await expect(
        service.updateSettings(admin, {
          telegram_chat_id: '',
          telegram_enabled: false,
          kitchen_stage_warning_minutes: 15,
          kitchen_late_threshold_minutes: 10,
          printer_paper_width: 58,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
    });

    it('guarda los colores y el umbral ámbar cuando son válidos', async () => {
      await service.updateSettings(admin, {
        telegram_chat_id: '',
        telegram_enabled: false,
        kitchen_stage_warning_minutes: 7,
        kitchen_late_threshold_minutes: 15,
        kitchen_color_fresh: '#00ff00',
        kitchen_color_warning: '#ffaa00',
        kitchen_color_late: '#ff0000',
        printer_paper_width: 58,
      });

      const colorCall = prisma.appSetting.upsert.mock.calls.find(
        (call) => call[0].where.businessId_key.key === 'kitchen_color_fresh',
      );
      expect(colorCall[0].create.value).toBe('#00ff00');
    });
  });

  // These two are read on every single sale (OrdersService.create), so they
  // are cached per business instead of hitting the DB each time.
  describe('flags de stock — caché del camino de venta', () => {
    const otroNegocio: CurrentUserPayload = {
      ...admin,
      id: 'u3',
      business_id: 'biz2',
    };

    it('lee los cuatro flags en una sola query y reusa el caché', async () => {
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'use_stock', value: 'true' },
        { key: 'stock_deduct_resale', value: 'true' },
        { key: 'stock_deduct_insumos', value: 'false' },
        { key: 'stock_deduct_made_unit', value: 'false' },
      ]);

      expect(await service.isStockTrackingEnabled(admin)).toBe(true);
      expect(await service.getStockControlFlags(admin)).toEqual({
        resale: true,
        insumos: false,
        madeUnit: false,
      });
      // Three reads across two different methods, one query.
      expect(await service.isStockTrackingEnabled(admin)).toBe(true);
      expect(prisma.appSetting.findMany).toHaveBeenCalledTimes(1);
    });

    // Variante por businessId para el menú público del QR, que no tiene JWT.
    // Comparte el mismo caché que la variante con usuario.
    it('isStockTrackingEnabledForBusiness comparte el caché con la variante con usuario', async () => {
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'use_stock', value: 'false' },
      ]);

      expect(await service.isStockTrackingEnabled(admin)).toBe(false);
      expect(await service.isStockTrackingEnabledForBusiness('biz1')).toBe(false);
      expect(prisma.appSetting.findMany).toHaveBeenCalledTimes(1);
    });

    it('cachea por negocio, sin filtrar valores de uno a otro', async () => {
      prisma.appSetting.findMany
        .mockResolvedValueOnce([{ key: 'use_stock', value: 'true' }])
        .mockResolvedValueOnce([{ key: 'use_stock', value: 'false' }]);

      expect(await service.isStockTrackingEnabled(admin)).toBe(true);
      expect(await service.isStockTrackingEnabled(otroNegocio)).toBe(false);
      expect(prisma.appSetting.findMany).toHaveBeenCalledTimes(2);
    });

    it('invalida el caché cuando el admin guarda Configuración', async () => {
      prisma.appSetting.findMany
        .mockResolvedValueOnce([{ key: 'use_stock', value: 'true' }])
        .mockResolvedValueOnce([{ key: 'use_stock', value: 'false' }]);

      expect(await service.isStockTrackingEnabled(admin)).toBe(true);

      await service.updateSettings(admin, {
        telegram_chat_id: '',
        telegram_enabled: false,
        kitchen_stage_warning_minutes: 7,
        kitchen_late_threshold_minutes: 15,
        printer_paper_width: 58,
        use_stock: false,
      });

      expect(await service.isStockTrackingEnabled(admin)).toBe(false);
      expect(prisma.appSetting.findMany).toHaveBeenCalledTimes(2);
    });

    it('no cachea el cruce con enabled_modules.produccion — se evalúa por request', async () => {
      prisma.appSetting.findMany.mockResolvedValue([
        { key: 'stock_deduct_made_unit', value: 'true' },
      ]);

      const conProduccion: CurrentUserPayload = {
        ...admin,
        enabled_modules: { ...DEFAULT_ENABLED_MODULES, produccion: true },
      };
      const sinProduccion: CurrentUserPayload = {
        ...admin,
        enabled_modules: { ...DEFAULT_ENABLED_MODULES, produccion: false },
      };

      expect((await service.getStockControlFlags(conProduccion)).madeUnit).toBe(
        true,
      );
      // Same business, same cached row, but the module is off for this
      // request — the crossing must not come from the cache.
      expect((await service.getStockControlFlags(sinProduccion)).madeUnit).toBe(
        false,
      );
      expect(prisma.appSetting.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
