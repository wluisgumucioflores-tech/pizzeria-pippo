import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';

const decimal = (value: number) => ({ toNumber: () => value }) as never;

const admin: CurrentUserPayload = {
  id: 'u1',
  email: 'admin@pippo.local',
  role: 'admin',
  branch_id: null,
  full_name: 'Admin',
  business_id: 'biz1',
  enabled_modules: DEFAULT_ENABLED_MODULES,
};

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    order: { findMany: jest.Mock; count: jest.Mock };
    orderItem: { findMany: jest.Mock; groupBy: jest.Mock };
    orderPayment: { findMany: jest.Mock };
    productionIngredientLog: { findMany: jest.Mock };
    productionOutputLog: { findMany: jest.Mock };
    branchProductStock: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let settingsService: { getStockControlFlags: jest.Mock };

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn(), count: jest.fn() },
      orderItem: { findMany: jest.fn(), groupBy: jest.fn() },
      orderPayment: { findMany: jest.fn() },
      productionIngredientLog: { findMany: jest.fn() },
      productionOutputLog: { findMany: jest.fn() },
      branchProductStock: { findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    settingsService = {
      getStockControlFlags: jest.fn().mockResolvedValue({ resale: true, insumos: true, madeUnit: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('getSales', () => {
    it('sums totals and splits by order type', async () => {
      prisma.order.findMany.mockResolvedValue([
        { total: decimal(100), orderType: 'dine_in', paymentMethod: 'efectivo' },
        { total: decimal(50), orderType: 'takeaway', paymentMethod: 'qr' },
        { total: decimal(25), orderType: 'takeaway', paymentMethod: null },
      ]);

      const result = await service.getSales({}, admin);

      expect(result.total).toBe(175);
      expect(result.count).toBe(3);
      expect(result.avg).toBeCloseTo(58.33, 1);
      expect(result.by_order_type.dine_in).toEqual({ total: 100, count: 1 });
      expect(result.by_order_type.takeaway).toEqual({ total: 75, count: 2 });
    });

    it('splits totals by payment method, including online', async () => {
      prisma.order.findMany.mockResolvedValue([
        { total: decimal(100), orderType: 'dine_in', paymentMethod: 'efectivo' },
        { total: decimal(50), orderType: 'takeaway', paymentMethod: 'qr' },
        { total: decimal(30), orderType: 'takeaway', paymentMethod: 'online' },
        { total: decimal(25), orderType: 'takeaway', paymentMethod: null },
      ]);

      const result = await service.getSales({}, admin);

      expect(result.by_payment_method).toEqual({
        efectivo: { total: 100, count: 1 },
        qr: { total: 50, count: 1 },
        online: { total: 30, count: 1 },
        mixto: { count: 0 },
        sin_especificar: { total: 25, count: 1 },
      });
    });

    it('folds split (mixto) orders into the efectivo/qr totals via order_payments', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', total: decimal(100), orderType: 'dine_in', paymentMethod: 'efectivo' },
        { id: 'order-2', total: decimal(50), orderType: 'takeaway', paymentMethod: 'mixto' },
      ]);
      prisma.orderPayment.findMany.mockResolvedValue([
        { method: 'efectivo', amount: decimal(20) },
        { method: 'qr', amount: decimal(30) },
      ]);

      const result = await service.getSales({}, admin);

      expect(result.by_payment_method).toEqual({
        efectivo: { total: 120, count: 1 },
        qr: { total: 30, count: 0 },
        online: { total: 0, count: 0 },
        mixto: { count: 1 },
        sin_especificar: { total: 0, count: 0 },
      });
      expect(prisma.orderPayment.findMany).toHaveBeenCalledWith({
        where: { orderId: { in: ['order-2'] } },
        select: { method: true, amount: true },
      });
    });

    it('returns zeroed summary when there are no orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.getSales({}, admin);

      expect(result).toEqual({
        total: 0,
        count: 0,
        avg: 0,
        by_order_type: {
          dine_in: { total: 0, count: 0 },
          takeaway: { total: 0, count: 0 },
          delivery: { total: 0, count: 0 },
          pedidos_ya: { total: 0, count: 0 },
        },
        by_payment_method: {
          efectivo: { total: 0, count: 0 },
          qr: { total: 0, count: 0 },
          online: { total: 0, count: 0 },
          mixto: { count: 0 },
          sin_especificar: { total: 0, count: 0 },
        },
      });
    });
  });

  describe('getDaily', () => {
    it('groups totals by Bolivia-local date', async () => {
      prisma.order.findMany.mockResolvedValue([
        { total: decimal(100), createdAt: new Date('2026-07-01T12:00:00.000Z') },
        { total: decimal(50), createdAt: new Date('2026-07-01T23:30:00.000Z') },
      ]);

      const result = await service.getDaily({}, admin);

      expect(result).toEqual([{ date: '2026-07-01', total: 150 }]);
    });
  });

  describe('getTopProducts', () => {
    it('aggregates qty and revenue per variant', async () => {
      const variant = { id: 'v1', name: 'Familiar', product: { name: 'Napolitana', category: 'pizza' } };
      prisma.orderItem.groupBy.mockResolvedValue([{ variantId: 'v1', _sum: { qty: 3 } }]);
      prisma.orderItem.findMany.mockResolvedValue([
        { qty: 2, unitPrice: decimal(50), discountApplied: decimal(0), variant },
        { qty: 1, unitPrice: decimal(50), discountApplied: decimal(10), variant },
      ]);

      const result = await service.getTopProducts({}, admin);

      expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ variantId: { in: ['v1'] } }) }),
      );
      expect(result).toEqual([
        { variant_id: 'v1', product_name: 'Napolitana', variant_name: 'Familiar', category: 'pizza', qty: 3, revenue: 140 },
      ]);
    });

    it('no consulta detalle si no hay ventas en el período (groupBy vacío)', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([]);

      const result = await service.getTopProducts({}, admin);

      expect(result).toEqual([]);
      expect(prisma.orderItem.findMany).not.toHaveBeenCalled();
    });

    it('el ranking del top 5 lo define el groupBy (LIMIT en la base), no un slice en memoria', async () => {
      const ranking = Array.from({ length: 5 }, (_, i) => ({ variantId: `v${i}`, _sum: { qty: 8 - i } }));
      prisma.orderItem.groupBy.mockResolvedValue(ranking);
      prisma.orderItem.findMany.mockResolvedValue(
        ranking.map(({ variantId }, i) => ({
          qty: 8 - i,
          unitPrice: decimal(10),
          discountApplied: decimal(0),
          variant: { id: variantId, name: 'Única', product: { name: `Producto ${i}`, category: 'pizza' } },
        })),
      );

      const result = await service.getTopProducts({}, admin);

      expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ by: ['variantId'], take: 5, orderBy: { _sum: { qty: 'desc' } } }),
      );
      expect(result).toHaveLength(5);
      expect(result.map((r) => r.variant_id)).toEqual(['v0', 'v1', 'v2', 'v3', 'v4']);
    });
  });

  describe('getCashiers', () => {
    it('groups orders and items by cashier', async () => {
      const variant = { id: 'v1', name: 'Familiar', product: { name: 'Napolitana', category: 'pizza' } };
      prisma.order.findMany.mockResolvedValue([
        {
          paidById: 'c1',
          paidBy: { fullName: 'Ana' },
          total: decimal(100),
          items: [{ qty: 2, unitPrice: decimal(50), discountApplied: decimal(0), variant }],
        },
      ]);

      const result = await service.getCashiers({}, admin);

      expect(result.cashiers).toEqual([
        {
          cashier_id: 'c1',
          cashier_name: 'Ana',
          orders: 1,
          total: 100,
          items: [{ variant_id: 'v1', product_name: 'Napolitana', variant_name: 'Familiar', category: 'pizza', qty: 2, revenue: 100 }],
        },
      ]);
    });

    it('sin branchId ("todas las sucursales"), branch_stock viene vacío aunque el switch esté activo', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });

      const result = await service.getCashiers({}, admin);

      expect(result.branch_stock).toEqual([]);
      expect(prisma.branchProductStock.findMany).not.toHaveBeenCalled();
    });

    it('con branchId puntual pero el switch "elaboración por unidad" apagado, branch_stock viene vacío', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.getCashiers({ branchId: 'b1' }, admin);

      expect(result.branch_stock).toEqual([]);
      expect(prisma.branchProductStock.findMany).not.toHaveBeenCalled();
    });

    it('con branchId puntual y el switch activo, devuelve el stock restante y sold_quantity=0 sin ventas en el período', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.branchProductStock.findMany.mockResolvedValue([
        { variantId: 'v1', quantity: decimal(14), variant: { name: 'Chico', product: { name: 'Alfajor' } } },
      ]);

      const result = await service.getCashiers({ branchId: 'b1' }, admin);

      expect(prisma.branchProductStock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: 'b1', variant: { product: { productType: 'made' } } } }),
      );
      expect(result.branch_stock).toEqual([
        { variant_id: 'v1', product_name: 'Alfajor', variant_name: 'Chico', quantity: 14, sold_quantity: 0 },
      ]);
    });

    it('sold_quantity refleja lo vendido en el período/sucursal filtrados (de todos los cajeros, no solo uno)', async () => {
      const variant = { id: 'v1', name: 'Chico', product: { name: 'Alfajor', category: null, categoryId: null } };
      prisma.order.findMany.mockResolvedValue([
        {
          paidById: 'c1',
          paidBy: { fullName: 'Ana' },
          total: decimal(20),
          items: [{ qty: 3, unitPrice: decimal(10), discountApplied: decimal(0), variant }],
        },
        {
          paidById: 'c2',
          paidBy: { fullName: 'Luis' },
          total: decimal(20),
          items: [{ qty: 2, unitPrice: decimal(10), discountApplied: decimal(0), variant }],
        },
      ]);
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.branchProductStock.findMany.mockResolvedValue([
        { variantId: 'v1', quantity: decimal(14), variant: { name: 'Chico', product: { name: 'Alfajor' } } },
      ]);

      const result = await service.getCashiers({ branchId: 'b1' }, admin);

      expect(result.branch_stock).toEqual([
        { variant_id: 'v1', product_name: 'Alfajor', variant_name: 'Chico', quantity: 14, sold_quantity: 5 },
      ]);
    });
  });

  describe('getProduction', () => {
    it('aggregates ingredient usage and output logs by ingredient/variant, ignoring branchId', async () => {
      prisma.productionIngredientLog.findMany.mockResolvedValue([
        { ingredientId: 'ing1', quantity: decimal(3), ingredient: { name: 'Harina', unit: 'kg' } },
        { ingredientId: 'ing1', quantity: decimal(2), ingredient: { name: 'Harina', unit: 'kg' } },
        { ingredientId: 'ing2', quantity: decimal(1), ingredient: { name: 'Azúcar', unit: 'kg' } },
      ]);
      prisma.productionOutputLog.findMany.mockResolvedValue([
        { variantId: 'v1', quantity: decimal(40), variant: { name: 'Única', product: { name: 'Alfajor' } } },
        { variantId: 'v1', quantity: decimal(10), variant: { name: 'Única', product: { name: 'Alfajor' } } },
      ]);

      const result = await service.getProduction({ branchId: 'b1' } as never, admin);

      expect(result.ingredients).toEqual([
        { ingredient_id: 'ing1', ingredient_name: 'Harina', unit: 'kg', total_quantity: 5 },
        { ingredient_id: 'ing2', ingredient_name: 'Azúcar', unit: 'kg', total_quantity: 1 },
      ]);
      expect(result.outputs).toEqual([
        { variant_id: 'v1', product_name: 'Alfajor', variant_name: 'Única', total_quantity: 50 },
      ]);
      expect(prisma.productionIngredientLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ businessId: 'biz1' }) }),
      );
      expect(prisma.productionIngredientLog.findMany.mock.calls[0][0].where).not.toHaveProperty('branchId');
    });

    it('returns empty arrays when there is no production in the period', async () => {
      prisma.productionIngredientLog.findMany.mockResolvedValue([]);
      prisma.productionOutputLog.findMany.mockResolvedValue([]);

      const result = await service.getProduction({}, admin);

      expect(result).toEqual({ ingredients: [], outputs: [] });
    });
  });

  describe('getOrders', () => {
    it('pagina el historial de órdenes y mapea el shape esperado por el frontend, incluyendo canceladas', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          dailyNumber: 5,
          total: decimal(70),
          createdAt: new Date('2026-07-01T12:00:00.000Z'),
          branchId: 'b1',
          paymentMethod: 'efectivo',
          orderType: 'dine_in',
          cancelledAt: new Date('2026-07-01T12:05:00.000Z'),
          cancelReason: 'cliente se arrepintió',
          branch: { name: 'Centro' },
          cashier: { fullName: 'Ana' },
          items: [
            {
              qty: 1,
              unitPrice: decimal(70),
              discountApplied: decimal(0),
              promoLabel: null,
              variant: { name: 'Familiar', product: { name: 'Napolitana', category: 'pizza' } },
            },
          ],
          payments: [],
        },
      ]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.getOrders({ page: 1, pageSize: 20 }, admin);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.data).toEqual([
        {
          id: 'o1',
          daily_number: 5,
          total: 70,
          created_at: '2026-07-01T12:00:00.000Z',
          branch_id: 'b1',
          cashier_name: 'Ana',
          payment_method: 'efectivo',
          order_type: 'dine_in',
          cancelled_at: '2026-07-01T12:05:00.000Z',
          cancel_reason: 'cliente se arrepintió',
          branches: { name: 'Centro' },
          order_items: [
            {
              qty: 1,
              unit_price: 70,
              discount_applied: 0,
              promo_label: null,
              product_variants: { name: 'Familiar', products: { name: 'Napolitana', category: 'pizza' } },
            },
          ],
          payments: [],
        },
      ]);
    });

    it('usa "—" cuando no hay cajero asociado', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o2',
          dailyNumber: 1,
          total: decimal(10),
          createdAt: new Date('2026-07-01T12:00:00.000Z'),
          branchId: 'b1',
          paymentMethod: null,
          orderType: 'takeaway',
          cancelledAt: null,
          cancelReason: null,
          branch: null,
          cashier: null,
          items: [],
          payments: [],
        },
      ]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.getOrders({}, admin);

      expect(result.data[0].cashier_name).toBe('—');
      expect(result.data[0].branches).toBeNull();
    });
  });
});
