import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

const decimal = (value: number) => ({ toNumber: () => value }) as never;

const admin: CurrentUserPayload = {
  id: 'u1',
  email: 'admin@pippo.local',
  role: 'admin',
  branch_id: null,
  full_name: 'Admin',
  business_id: 'biz1',
};

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    order: { findMany: jest.Mock; count: jest.Mock };
    orderItem: { findMany: jest.Mock; groupBy: jest.Mock };
    orderPayment: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn(), count: jest.fn() },
      orderItem: { findMany: jest.fn(), groupBy: jest.fn() },
      orderPayment: { findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
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
          cashierId: 'c1',
          cashier: { fullName: 'Ana' },
          total: decimal(100),
          items: [{ qty: 2, unitPrice: decimal(50), discountApplied: decimal(0), variant }],
        },
      ]);

      const result = await service.getCashiers({}, admin);

      expect(result).toEqual([
        {
          cashier_id: 'c1',
          cashier_name: 'Ana',
          orders: 1,
          total: 100,
          items: [{ variant_id: 'v1', product_name: 'Napolitana', variant_name: 'Familiar', category: 'pizza', qty: 2, revenue: 100 }],
        },
      ]);
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
