import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';
import { PublicOnlineOrdersService } from './public-online-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OrdersGateway } from '../orders/realtime/orders.gateway';

// Decimal stand-in — Prisma returns objects with .toNumber(), not plain numbers.
const dec = (n: number) => ({ toNumber: () => n });

const ONLINE_MODULES = { ...DEFAULT_ENABLED_MODULES, onlineOrders: true };

describe('PublicOnlineOrdersService', () => {
  let service: PublicOnlineOrdersService;
  let prisma: {
    branch: { findUnique: jest.Mock };
    product: { findMany: jest.Mock };
    productVariant: { findMany: jest.Mock };
    branchProductStock: { findMany: jest.Mock };
    onlineOrder: { create: jest.Mock; findUnique: jest.Mock };
  };
  let settings: {
    getOnlineOrdersConfig: jest.Mock;
    isStockTrackingEnabledForBusiness: jest.Mock;
  };
  let gateway: { emitOnlineOrderCreated: jest.Mock };

  const activeBranch = {
    id: 'br1',
    name: 'Centro',
    isActive: true,
    businessId: 'biz1',
    business: {
      id: 'biz1',
      name: 'Pizzería Pippo',
      isActive: true,
      enabledModules: ONLINE_MODULES,
    },
  };

  const defaultConfig = {
    whatsapp: '+59170000000',
    expireMinutes: 30,
    menuMode: 'all' as const,
    categoryIds: [],
    productIds: [],
  };

  beforeEach(async () => {
    prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue(activeBranch) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      productVariant: { findMany: jest.fn().mockResolvedValue([]) },
      branchProductStock: { findMany: jest.fn().mockResolvedValue([]) },
      onlineOrder: {
        create: jest.fn().mockResolvedValue({
          id: 'oo1',
          createdAt: new Date('2026-10-26T12:00:00Z'),
        }),
        findUnique: jest.fn(),
      },
    };
    settings = {
      getOnlineOrdersConfig: jest.fn().mockResolvedValue(defaultConfig),
      isStockTrackingEnabledForBusiness: jest.fn().mockResolvedValue(false),
    };
    gateway = { emitOnlineOrderCreated: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicOnlineOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
        { provide: OrdersGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(PublicOnlineOrdersService);
  });

  // Un endpoint público no debe dejar que un extraño sondee qué branch ids
  // existen: todos estos casos tienen que dar el MISMO 404 genérico.
  describe('control de acceso', () => {
    const cases: [string, unknown][] = [
      ['la sucursal no existe', null],
      ['la sucursal está inactiva', { ...activeBranch, isActive: false }],
      [
        'el negocio está suspendido',
        {
          ...activeBranch,
          business: { ...activeBranch.business, isActive: false },
        },
      ],
      [
        'el módulo onlineOrders está apagado',
        {
          ...activeBranch,
          business: {
            ...activeBranch.business,
            enabledModules: DEFAULT_ENABLED_MODULES,
          },
        },
      ],
      [
        'el negocio no tiene enabled_modules',
        {
          ...activeBranch,
          business: { ...activeBranch.business, enabledModules: {} },
        },
      ],
    ];

    it.each(cases)(
      'rechaza el menú con 404 genérico si %s',
      async (_label, branch) => {
        prisma.branch.findUnique.mockResolvedValue(branch);
        await expect(service.getMenu('br1')).rejects.toThrow(NotFoundException);
        await expect(service.getMenu('br1')).rejects.toThrow(
          'Este menú no está disponible',
        );
      },
    );

    it('rechaza también la creación de pedidos, no solo la lectura del menú', async () => {
      prisma.branch.findUnique.mockResolvedValue({
        ...activeBranch,
        business: {
          ...activeBranch.business,
          enabledModules: DEFAULT_ENABLED_MODULES,
        },
      });

      await expect(
        service.createOrder({
          branch_id: 'br1',
          customer_name: 'Juan',
          customer_phone: '+59170000000',
          items: [{ variant_id: 'v1', qty: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.onlineOrder.create).not.toHaveBeenCalled();
    });
  });

  describe('getMenu', () => {
    const pizzaProduct = {
      id: 'p1',
      name: 'Napolitana',
      description: 'Salsa y mozzarella',
      imageUrl: 'img.jpg',
      categoryId: 'cat1',
      categoryRef: { name: 'Pizzas' },
      productType: 'made',
      variants: [
        {
          id: 'v1',
          name: 'Grande',
          basePrice: dec(60),
          branchPrices: [{ branchId: 'br1', price: dec(75) }],
        },
      ],
    };

    it('resuelve el precio de la sucursal, no el precio base', async () => {
      prisma.product.findMany.mockResolvedValue([pizzaProduct]);

      const result = await service.getMenu('br1');

      expect(result.products[0].variants[0].price).toBe(75);
    });

    // Lo que NO se publica es tan importante como lo que sí: esta respuesta
    // la recibe cualquiera con el link.
    it('no expone recetas, costos, product_type ni el array de branch_prices', async () => {
      prisma.product.findMany.mockResolvedValue([pizzaProduct]);

      const result = await service.getMenu('br1');
      const serialized = JSON.stringify(result);

      expect(Object.keys(result.products[0].variants[0]).sort()).toEqual([
        'id',
        'name',
        'price',
      ]);
      expect(serialized).not.toContain('recipes');
      expect(serialized).not.toContain('branch_prices');
      expect(serialized).not.toContain('product_type');
      expect(serialized).not.toContain('basePrice');
    });

    it('descarta variantes sin precio en la sucursal para productos de elaboración propia', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...pizzaProduct,
          variants: [{ ...pizzaProduct.variants[0], branchPrices: [] }],
        },
      ]);

      const result = await service.getMenu('br1');

      expect(result.products).toEqual([]);
    });

    it('un producto de reventa sin precio de sucursal usa su precio base', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...pizzaProduct,
          productType: 'resale',
          variants: [
            { id: 'v2', name: '2L', basePrice: dec(15), branchPrices: [] },
          ],
        },
      ]);

      const result = await service.getMenu('br1');

      expect(result.products[0].variants[0].price).toBe(15);
    });

    it('avisa si el negocio no configuró WhatsApp, para esconder el botón', async () => {
      settings.getOnlineOrdersConfig.mockResolvedValue({
        ...defaultConfig,
        whatsapp: '',
      });
      prisma.product.findMany.mockResolvedValue([pizzaProduct]);

      const result = await service.getMenu('br1');

      expect(result.whatsapp_configured).toBe(false);
    });

    describe('stock de reventa', () => {
      const resale = {
        ...pizzaProduct,
        id: 'p2',
        productType: 'resale',
        variants: [
          { id: 'v2', name: '2L', basePrice: dec(15), branchPrices: [] },
        ],
      };

      it('esconde reventa sin stock si el negocio usa inventario', async () => {
        settings.isStockTrackingEnabledForBusiness.mockResolvedValue(true);
        prisma.product.findMany.mockResolvedValue([resale]);
        prisma.branchProductStock.findMany.mockResolvedValue([
          { variantId: 'v2', quantity: dec(0) },
        ]);

        const result = await service.getMenu('br1');

        expect(result.products).toEqual([]);
      });

      // Sin fila de stock = nunca se abasteció en esta sucursal.
      it('esconde reventa sin fila de stock en la sucursal', async () => {
        settings.isStockTrackingEnabledForBusiness.mockResolvedValue(true);
        prisma.product.findMany.mockResolvedValue([resale]);
        prisma.branchProductStock.findMany.mockResolvedValue([]);

        const result = await service.getMenu('br1');

        expect(result.products).toEqual([]);
      });

      it('la muestra si hay stock', async () => {
        settings.isStockTrackingEnabledForBusiness.mockResolvedValue(true);
        prisma.product.findMany.mockResolvedValue([resale]);
        prisma.branchProductStock.findMany.mockResolvedValue([
          { variantId: 'v2', quantity: dec(4) },
        ]);

        const result = await service.getMenu('br1');

        expect(result.products[0].variants[0].id).toBe('v2');
      });

      it('no consulta stock si el negocio no usa inventario', async () => {
        prisma.product.findMany.mockResolvedValue([resale]);

        const result = await service.getMenu('br1');

        expect(prisma.branchProductStock.findMany).not.toHaveBeenCalled();
        expect(result.products).toHaveLength(1);
      });
    });
  });

  describe('createOrder', () => {
    const variant = {
      id: 'v1',
      name: 'Grande',
      productId: 'p1',
      isActive: true,
      basePrice: dec(60),
      branchPrices: [{ branchId: 'br1', price: dec(75) }],
      product: {
        id: 'p1',
        name: 'Napolitana',
        isActive: true,
        categoryId: 'cat1',
        productType: 'made',
      },
    };

    const dto = {
      branch_id: 'br1',
      customer_name: '  Juan Pérez  ',
      customer_phone: '+59171234567',
      items: [{ variant_id: 'v1', qty: 2 }],
    };

    // LA regla central del endpoint público.
    it('calcula el total con el precio de la base de datos, no con lo que manda el cliente', async () => {
      prisma.productVariant.findMany.mockResolvedValue([variant]);

      const result = await service.createOrder(dto);

      // 2 x 75 (precio de sucursal), no 2 x 60 (base) ni nada enviado por el cliente
      expect(result.total).toBe(150);
      expect(prisma.onlineOrder.create.mock.calls[0][0].data.total).toBe(150);
      expect(
        prisma.onlineOrder.create.mock.calls[0][0].data.items.create,
      ).toEqual([{ variantId: 'v1', qty: 2, unitPrice: 75 }]);
    });

    it('solo busca variantes del negocio de esa sucursal', async () => {
      prisma.productVariant.findMany.mockResolvedValue([variant]);

      await service.createOrder(dto);

      expect(
        prisma.productVariant.findMany.mock.calls[0][0].where,
      ).toMatchObject({
        businessId: 'biz1',
      });
    });

    it('guarda token y referencia derivada, y recorta nombre y teléfono', async () => {
      prisma.productVariant.findMany.mockResolvedValue([variant]);

      const result = await service.createOrder(dto);
      const data = prisma.onlineOrder.create.mock.calls[0][0].data;

      expect(data.customerName).toBe('Juan Pérez');
      expect(data.publicToken).toBe(result.public_token);
      expect(result.reference).toBe(
        result.public_token.slice(0, 6).toUpperCase(),
      );
      expect(result.public_token).toMatch(/^[0-9a-f]{48}$/);
    });

    it('arma el link de WhatsApp con el total del servidor', async () => {
      prisma.productVariant.findMany.mockResolvedValue([variant]);

      const result = await service.createOrder(dto);

      expect(result.whatsapp_url).toContain('https://wa.me/59170000000?text=');
      expect(decodeURIComponent(result.whatsapp_url)).toContain('150.00 Bs');
    });

    // Este es el aviso en el que el negocio SÍ confía — el WhatsApp depende de
    // que el cliente apriete enviar, y eso no se puede verificar.
    it('avisa al cajero en vivo por socket, a la sucursal correcta', async () => {
      prisma.productVariant.findMany.mockResolvedValue([variant]);

      const result = await service.createOrder(dto);

      expect(gateway.emitOnlineOrderCreated).toHaveBeenCalledWith('br1', {
        id: 'oo1',
        reference: result.reference,
        customer_name: 'Juan Pérez',
        total: 150,
        created_at: '2026-10-26T12:00:00.000Z',
        expires_at: result.expires_at,
      });
    });

    it('usa los minutos de expiración configurados', async () => {
      settings.getOnlineOrdersConfig.mockResolvedValue({
        ...defaultConfig,
        expireMinutes: 10,
      });
      prisma.productVariant.findMany.mockResolvedValue([variant]);

      const result = await service.createOrder(dto);
      const expiresAt = new Date(result.expires_at).getTime();

      expect(expiresAt - Date.now()).toBeGreaterThan(9 * 60_000);
      expect(expiresAt - Date.now()).toBeLessThanOrEqual(10 * 60_000);
    });

    describe('rechazos', () => {
      const expectRejected = async () => {
        await expect(service.createOrder(dto)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.onlineOrder.create).not.toHaveBeenCalled();
      };

      it('rechaza una variante que no existe', async () => {
        prisma.productVariant.findMany.mockResolvedValue([]);
        await expectRejected();
      });

      it('rechaza una variante inactiva', async () => {
        prisma.productVariant.findMany.mockResolvedValue([
          { ...variant, isActive: false },
        ]);
        await expectRejected();
      });

      it('rechaza un producto inactivo', async () => {
        prisma.productVariant.findMany.mockResolvedValue([
          { ...variant, product: { ...variant.product, isActive: false } },
        ]);
        await expectRejected();
      });

      // Si el filtro del menú solo se aplicara al listado, cualquiera podría
      // pedir un producto escondido mandando su variant_id directo.
      it('rechaza un producto que el filtro del menú esconde', async () => {
        settings.getOnlineOrdersConfig.mockResolvedValue({
          ...defaultConfig,
          menuMode: 'categories',
          categoryIds: ['otra-categoria'],
        });
        prisma.productVariant.findMany.mockResolvedValue([variant]);
        await expectRejected();
      });

      it('rechaza elaboración propia sin precio en la sucursal', async () => {
        prisma.productVariant.findMany.mockResolvedValue([
          { ...variant, branchPrices: [] },
        ]);
        await expectRejected();
      });
    });
  });

  describe('getStatus', () => {
    const storedOrder = (over: Record<string, unknown> = {}) => ({
      publicToken: 'abcdef1234567890',
      status: 'pending',
      total: dec(150),
      createdAt: new Date('2026-10-26T12:00:00Z'),
      expiresAt: new Date('2100-01-01T00:00:00Z'),
      rejectReason: null,
      order: null,
      items: [
        {
          qty: 2,
          unitPrice: dec(75),
          variant: { name: 'Grande', product: { name: 'Napolitana' } },
        },
      ],
      ...over,
    });

    it('404 si el token no existe', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('inventado')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve los items y el total', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(storedOrder());

      const result = await service.getStatus('abcdef1234567890');

      expect(result.status).toBe('pending');
      expect(result.total).toBe(150);
      expect(result.items).toEqual([
        {
          product_name: 'Napolitana',
          variant_name: 'Grande',
          qty: 2,
          unit_price: 75,
        },
      ]);
      expect(result.daily_number).toBeNull();
    });

    // El cron puede no haber corrido todavía; el cliente nunca debe ver
    // "pendiente" en un pedido que ya nadie puede confirmar.
    it('reporta expired aunque la fila siga en pending, sin escribir nada', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(
        storedOrder({ expiresAt: new Date('2020-01-01T00:00:00Z') }),
      );

      const result = await service.getStatus('abcdef1234567890');

      expect(result.status).toBe('expired');
    });

    it('expone el número de pedido una vez confirmado', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(
        storedOrder({ status: 'confirmed', order: { dailyNumber: 42 } }),
      );

      const result = await service.getStatus('abcdef1234567890');

      expect(result.status).toBe('confirmed');
      expect(result.daily_number).toBe(42);
    });

    it('expone el motivo si fue rechazado', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(
        storedOrder({ status: 'rejected', rejectReason: 'Sin stock' }),
      );

      const result = await service.getStatus('abcdef1234567890');

      expect(result.status).toBe('rejected');
      expect(result.reject_reason).toBe('Sin stock');
    });

    // No expone datos de otro cliente ni el id interno de la fila.
    it('no devuelve nombre, teléfono ni id interno del pedido', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(
        storedOrder({
          customerName: 'Juan',
          customerPhone: '+591700',
          id: 'uuid-interno',
        }),
      );

      const serialized = JSON.stringify(
        await service.getStatus('abcdef1234567890'),
      );

      expect(serialized).not.toContain('Juan');
      expect(serialized).not.toContain('+591700');
      expect(serialized).not.toContain('uuid-interno');
    });
  });
});
