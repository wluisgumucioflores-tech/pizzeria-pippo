import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { LowStockAlertService } from '../notifications/low-stock-alert.service';
import { OrdersGateway } from './realtime/orders.gateway';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { CreateOrderDto } from './dto/create-order.dto';
import { todayInBolivia } from '../common/utils/timezone';

function decimal(value: number) {
  return { toNumber: () => value };
}

interface TxMock {
  order: { updateMany: jest.Mock };
  branchStock: { updateMany: jest.Mock };
  stockMovement: { create: jest.Mock };
  branchProductStock: { updateMany: jest.Mock };
  productStockMovement: { create: jest.Mock };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let tx: TxMock;
  let prisma: {
    productVariant: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
    order: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    branch: { findUnique: jest.Mock };
  };
  let promotionsService: { list: jest.Mock };
  let lowStockAlertService: { checkAndNotify: jest.Mock };
  let ordersGateway: { emitOrderCreated: jest.Mock; emitOrderUpdated: jest.Mock };

  const cashier: CurrentUserPayload = {
    id: 'u1',
    email: 'cajero@pippo.local',
    role: 'cajero',
    branch_id: 'b1',
    full_name: 'Cajero',
    business_id: 'biz1',
  };

  const madeVariant = {
    id: 'v-pizza',
    name: 'Familiar',
    basePrice: decimal(70),
    isActive: true,
    branchPrices: [{ branchId: 'b1', price: decimal(75) }],
    recipes: [{ ingredientId: 'i-masa', quantity: decimal(1), applyCondition: 'always', ingredient: { isSharedUse: false } }],
    product: { name: 'Hawaiana', category: 'pizza', productType: 'made', isActive: true },
  };

  const resaleVariant = {
    id: 'v-coca',
    name: 'Unidad',
    basePrice: decimal(10),
    isActive: true,
    branchPrices: [],
    recipes: [],
    product: { name: 'Coca-Cola', category: 'bebida', productType: 'resale', isActive: true },
  };

  function baseDto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
    return {
      branch_id: 'b1',
      total: 75,
      payment_method: 'efectivo',
      order_type: 'dine_in',
      idempotency_key: null,
      items: [{ variant_id: 'v-pizza', qty: 1 }],
      ...overrides,
    } as CreateOrderDto;
  }

  beforeEach(async () => {
    tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      branchStock: { updateMany: jest.fn() },
      stockMovement: { create: jest.fn() },
      branchProductStock: { updateMany: jest.fn() },
      productStockMovement: { create: jest.fn() },
    };
    prisma = {
      productVariant: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (cb: (tx: TxMock) => unknown) => cb(tx)),
      order: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) },
    };
    promotionsService = { list: jest.fn().mockResolvedValue([]) };
    lowStockAlertService = { checkAndNotify: jest.fn() };
    ordersGateway = { emitOrderCreated: jest.fn(), emitOrderUpdated: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PromotionsService, useValue: promotionsService },
        { provide: LowStockAlertService, useValue: lowStockAlertService },
        { provide: OrdersGateway, useValue: ordersGateway },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('resuelve el precio server-side por sucursal y llama a create_order_atomic', async () => {
    prisma.productVariant.findMany.mockResolvedValue([madeVariant]);
    prisma.$queryRaw.mockResolvedValue([{ create_order_atomic: { order_id: 'o1', daily_number: 3, duplicate: false } }]);

    const result = await service.create(baseDto({ total: 75 }), cashier);

    expect(result).toEqual({ order_id: 'o1', daily_number: 3, duplicate: false });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rechaza si la variante no tiene precio para la sucursal y el producto no es de reventa', async () => {
    const variantSinPrecio = { ...madeVariant, branchPrices: [] };
    prisma.productVariant.findMany.mockResolvedValue([variantSinPrecio]);

    await expect(service.create(baseDto(), cashier)).rejects.toThrow(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('no exige branch_price para productos de reventa', async () => {
    prisma.productVariant.findMany.mockResolvedValue([resaleVariant]);
    prisma.$queryRaw.mockResolvedValue([{ create_order_atomic: { order_id: 'o2', daily_number: 1, duplicate: false } }]);

    const dto = baseDto({ total: 10, items: [{ variant_id: 'v-coca', qty: 1 }] });

    await expect(service.create(dto, cashier)).resolves.toEqual({ order_id: 'o2', daily_number: 1, duplicate: false });
  });

  it('rechaza si el producto o la variante están inactivos', async () => {
    prisma.productVariant.findMany.mockResolvedValue([{ ...madeVariant, isActive: false }]);

    await expect(service.create(baseDto(), cashier)).rejects.toThrow(BadRequestException);
  });

  it('rechaza con 409 si el total del cliente no coincide con el calculado en el servidor', async () => {
    prisma.productVariant.findMany.mockResolvedValue([madeVariant]);

    await expect(service.create(baseDto({ total: 999 }), cashier)).rejects.toThrow(ConflictException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('dispara la alerta de stock bajo (fire-and-forget) cuando hay deducciones de ingredientes', async () => {
    prisma.productVariant.findMany.mockResolvedValue([madeVariant]);
    prisma.$queryRaw.mockResolvedValue([{ create_order_atomic: { order_id: 'o1', daily_number: 1, duplicate: false } }]);

    await service.create(baseDto({ total: 75 }), cashier);

    expect(lowStockAlertService.checkAndNotify).toHaveBeenCalledWith('biz1', 'b1', ['i-masa'], []);
  });

  it('rechaza con 404 si el usuario no tiene business_id (no puede ser dueño de ninguna sucursal)', async () => {
    const sinNegocio: CurrentUserPayload = { ...cashier, business_id: null };

    await expect(service.create(baseDto({ total: 75 }), sinNegocio)).rejects.toThrow(NotFoundException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rechaza con 404 si el branch_id del pedido es de otro negocio', async () => {
    prisma.branch.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

    await expect(service.create(baseDto(), cashier)).rejects.toThrow(NotFoundException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('dispara la alerta de stock con deducciones de reventa cuando la venta es solo de reventa', async () => {
    prisma.productVariant.findMany.mockResolvedValue([resaleVariant]);
    prisma.$queryRaw.mockResolvedValue([{ create_order_atomic: { order_id: 'o2', daily_number: 1, duplicate: false } }]);

    await service.create(baseDto({ total: 10, items: [{ variant_id: 'v-coca', qty: 1 }] }), cashier);

    expect(lowStockAlertService.checkAndNotify).toHaveBeenCalledWith('biz1', 'b1', [], ['v-coca']);
  });

  it('no dispara la alerta si no hubo deducciones de ningún tipo', async () => {
    const variantSinReceta = { ...madeVariant, recipes: [] };
    prisma.productVariant.findMany.mockResolvedValue([variantSinReceta]);
    prisma.$queryRaw.mockResolvedValue([{ create_order_atomic: { order_id: 'o3', daily_number: 1, duplicate: false } }]);

    await service.create(baseDto({ total: 75 }), cashier);

    expect(lowStockAlertService.checkAndNotify).not.toHaveBeenCalled();
  });

  it('emite order:created para que cocina/POS se enteren en vivo de la orden nueva', async () => {
    prisma.productVariant.findMany.mockResolvedValue([madeVariant]);
    prisma.$queryRaw.mockResolvedValue([{ create_order_atomic: { order_id: 'o1', daily_number: 3, duplicate: false } }]);

    await service.create(baseDto({ total: 75 }), cashier);

    expect(ordersGateway.emitOrderCreated).toHaveBeenCalledWith('b1', { id: 'o1', daily_number: 3 });
  });

  it('no emite order:created cuando la orden ya existía (hit de idempotencia)', async () => {
    prisma.productVariant.findMany.mockResolvedValue([madeVariant]);
    prisma.$queryRaw.mockResolvedValue([{ create_order_atomic: { order_id: 'o1', daily_number: 3, duplicate: true } }]);

    await service.create(baseDto({ total: 75 }), cashier);

    expect(ordersGateway.emitOrderCreated).not.toHaveBeenCalled();
  });

  describe('getDayOrders', () => {
    it('mapea las órdenes del día con sus items, sin excluir canceladas', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          dailyNumber: 5,
          createdAt: new Date('2026-07-05T18:00:00Z'),
          total: decimal(75),
          kitchenStatus: 'ready',
          paymentMethod: 'efectivo',
          orderType: 'dine_in',
          cancelledAt: null,
          items: [{
            qty: 1,
            qtyPhysical: 1,
            unitPrice: decimal(75),
            discountApplied: decimal(0),
            promoLabel: null,
            variant: { name: 'Familiar', product: { name: 'Hawaiana' } },
          }],
          payments: [],
        },
        {
          id: 'o2',
          dailyNumber: 4,
          createdAt: new Date('2026-07-05T17:00:00Z'),
          total: decimal(10),
          kitchenStatus: 'pending',
          paymentMethod: 'qr',
          orderType: 'takeaway',
          cancelledAt: new Date('2026-07-05T17:05:00Z'),
          items: [],
          payments: [],
        },
      ]);

      const result = await service.getDayOrders('b1', '2026-07-05', cashier);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ branchId: 'b1' }) }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'o1',
        daily_number: 5,
        created_at: '2026-07-05T18:00:00.000Z',
        total: 75,
        kitchen_status: 'ready',
        payment_method: 'efectivo',
        order_type: 'dine_in',
        cancelled_at: null,
        order_items: [{
          qty: 1,
          qty_physical: 1,
          unit_price: 75,
          discount_applied: 0,
          promo_label: null,
          product_variants: { name: 'Familiar', products: { name: 'Hawaiana' } },
        }],
        payments: [],
      });
      expect(result[1].cancelled_at).toBe('2026-07-05T17:05:00.000Z');
    });

    it('usa el día de hoy en Bolivia cuando no se especifica fecha', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.getDayOrders('b1', undefined, cashier);

      expect(prisma.order.findMany).toHaveBeenCalled();
    });

    it('incluye el desglose de payments en una orden con pago mixto', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o3',
          dailyNumber: 6,
          createdAt: new Date('2026-07-05T19:00:00Z'),
          total: decimal(30),
          kitchenStatus: 'ready',
          paymentMethod: 'mixto',
          orderType: 'dine_in',
          cancelledAt: null,
          items: [],
          payments: [
            { method: 'efectivo', amount: decimal(10) },
            { method: 'qr', amount: decimal(20) },
          ],
        },
      ]);

      const result = await service.getDayOrders('b1', '2026-07-05', cashier);

      expect(result[0].payments).toEqual([
        { method: 'efectivo', amount: 10 },
        { method: 'qr', amount: 20 },
      ]);
    });
  });

  describe('getPendingKitchenOrders', () => {
    it('mapea las órdenes pendientes con items y sabores mixtos', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          dailyNumber: 3,
          createdAt: new Date('2026-07-06T12:00:00Z'),
          kitchenStatus: 'pending',
          orderType: 'dine_in',
          items: [
            {
              id: 'i1',
              qty: 2,
              qtyPhysical: 2,
              variant: { name: 'Familiar', product: { name: 'Hawaiana', description: 'Jamón y piña' } },
              flavors: [
                {
                  variantId: 'v2',
                  proportion: decimal(0.5),
                  variant: { product: { name: 'Napolitana' } },
                },
              ],
            },
          ],
        },
      ]);

      const result = await service.getPendingKitchenOrders('b1', cashier);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: 'b1', kitchenStatus: 'pending', cancelledAt: null },
        }),
      );
      expect(result).toEqual([
        {
          id: 'o1',
          daily_number: 3,
          created_at: '2026-07-06T12:00:00.000Z',
          kitchen_status: 'pending',
          order_type: 'dine_in',
          order_items: [
            {
              id: 'i1',
              qty: 2,
              qty_physical: 2,
              product_variants: { name: 'Familiar', products: { name: 'Hawaiana', description: 'Jamón y piña' } },
              order_item_flavors: [
                { variant_id: 'v2', proportion: 0.5, product_variants: { products: { name: 'Napolitana' } } },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe('markReady', () => {
    it('marca la orden como lista cuando el cajero es de la misma sucursal', async () => {
      prisma.order.findUnique.mockResolvedValue({ branchId: 'b1', cancelledAt: null, branch: { businessId: 'biz1' } });

      await service.markReady('o1', cashier);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { kitchenStatus: 'ready' },
      });
      expect(ordersGateway.emitOrderUpdated).toHaveBeenCalledWith('b1', {
        id: 'o1',
        kitchen_status: 'ready',
        cancelled_at: null,
      });
    });

    it('permite a un admin marcar lista una orden de cualquier sucursal de su propio negocio', async () => {
      prisma.order.findUnique.mockResolvedValue({ branchId: 'otra-sucursal', cancelledAt: null, branch: { businessId: 'biz1' } });
      const admin: CurrentUserPayload = { ...cashier, role: 'admin' };

      await expect(service.markReady('o1', admin)).resolves.toBeUndefined();
    });

    it('rechaza con 404 si la orden no existe', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.markReady('o404', cashier)).rejects.toThrow(NotFoundException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('rechaza con 404 si la orden pertenece a otro negocio (ni siquiera un admin la ve)', async () => {
      prisma.order.findUnique.mockResolvedValue({ branchId: 'b1', cancelledAt: null, branch: { businessId: 'otro-negocio' } });
      const admin: CurrentUserPayload = { ...cashier, role: 'admin' };

      await expect(service.markReady('o1', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si la orden está anulada', async () => {
      prisma.order.findUnique.mockResolvedValue({ branchId: 'b1', cancelledAt: new Date(), branch: { businessId: 'biz1' } });

      await expect(service.markReady('o1', cashier)).rejects.toThrow(ConflictException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('rechaza con 403 si el cajero no es de la sucursal de la orden', async () => {
      prisma.order.findUnique.mockResolvedValue({ branchId: 'otra-sucursal', cancelledAt: null, branch: { businessId: 'biz1' } });

      await expect(service.markReady('o1', cashier)).rejects.toThrow(ForbiddenException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    // Noon in Bolivia time, safely inside "today" regardless of when the test suite runs
    const today = new Date(`${todayInBolivia()}T12:00:00-04:00`);

    function orderWithItems(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'o1',
        branchId: 'b1',
        orderType: 'dine_in',
        kitchenStatus: 'pending',
        createdAt: today,
        cancelledAt: null,
        branch: { businessId: 'biz1' },
        items: [{ variantId: 'v-pizza', qtyPhysical: 1, flavors: [] }],
        ...overrides,
      };
    }

    it('rechaza con 400 si falta el motivo', async () => {
      await expect(service.cancelOrder('o1', { reason: '  ' }, cashier)).rejects.toThrow(BadRequestException);
      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it('rechaza con 404 si la orden no existe', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.cancelOrder('o404', { reason: 'motivo' }, cashier)).rejects.toThrow(NotFoundException);
    });

    it('rechaza con 404 si la orden pertenece a otro negocio (ni siquiera un admin la ve)', async () => {
      prisma.order.findUnique.mockResolvedValue(orderWithItems({ branch: { businessId: 'otro-negocio' } }));
      const admin: CurrentUserPayload = { ...cashier, role: 'admin' };

      await expect(service.cancelOrder('o1', { reason: 'motivo' }, admin)).rejects.toThrow(NotFoundException);
    });

    it('rechaza con 409 si la orden ya está anulada', async () => {
      prisma.order.findUnique.mockResolvedValue(orderWithItems({ cancelledAt: new Date() }));

      await expect(service.cancelOrder('o1', { reason: 'motivo' }, cashier)).rejects.toThrow(ConflictException);
    });

    it('rechaza con 403 si el cajero no es de la sucursal de la orden', async () => {
      prisma.order.findUnique.mockResolvedValue(orderWithItems({ branchId: 'otra-sucursal' }));

      await expect(service.cancelOrder('o1', { reason: 'motivo' }, cashier)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza con 403 si el cajero intenta anular una orden de otro día', async () => {
      prisma.order.findUnique.mockResolvedValue(orderWithItems({ createdAt: new Date('2020-01-01T12:00:00Z') }));

      await expect(service.cancelOrder('o1', { reason: 'motivo' }, cashier)).rejects.toThrow(ForbiddenException);
    });

    it('un admin puede anular una orden de otra sucursal y de otro día', async () => {
      prisma.order.findUnique.mockResolvedValue(
        orderWithItems({ branchId: 'otra-sucursal', createdAt: new Date('2020-01-01T12:00:00Z') }),
      );
      prisma.productVariant.findMany.mockResolvedValue([madeVariant]);
      const admin: CurrentUserPayload = { ...cashier, role: 'admin' };

      await expect(service.cancelOrder('o1', { reason: 'motivo' }, admin)).resolves.toBeUndefined();
    });

    it('revierte stock de insumos y de reventa, y registra los movimientos de anulación', async () => {
      prisma.order.findUnique.mockResolvedValue(
        orderWithItems({
          items: [
            { variantId: 'v-pizza', qtyPhysical: 1, flavors: [] },
            { variantId: 'v-coca', qtyPhysical: 2, flavors: [] },
          ],
        }),
      );
      prisma.productVariant.findMany.mockResolvedValue([madeVariant, resaleVariant]);

      await service.cancelOrder('o1', { reason: 'cliente se arrepintió' }, cashier);

      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o1', cancelledAt: null },
        data: expect.objectContaining({ cancelledBy: 'u1', cancelReason: 'cliente se arrepintió' }),
      });
      expect(tx.branchStock.updateMany).toHaveBeenCalledWith({
        where: { branchId: 'b1', ingredientId: 'i-masa' },
        data: { quantity: { increment: 1 } },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'anulacion', ingredientId: 'i-masa' }) }),
      );
      expect(tx.branchProductStock.updateMany).toHaveBeenCalledWith({
        where: { branchId: 'b1', variantId: 'v-coca' },
        data: { quantity: { increment: 2 } },
      });
      expect(tx.productStockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'anulacion', variantId: 'v-coca' }) }),
      );
      expect(ordersGateway.emitOrderUpdated).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({ id: 'o1', kitchen_status: 'pending', cancelled_at: expect.any(String) }),
      );
    });

    it('rechaza con 409 si la orden fue anulada por otro proceso justo antes (carrera)', async () => {
      prisma.order.findUnique.mockResolvedValue(orderWithItems());
      prisma.productVariant.findMany.mockResolvedValue([madeVariant]);
      tx.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancelOrder('o1', { reason: 'motivo' }, cashier)).rejects.toThrow(ConflictException);
      expect(tx.branchStock.updateMany).not.toHaveBeenCalled();
    });
  });
});
