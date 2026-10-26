import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';
import { OnlineOrdersService } from './online-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersGateway } from '../orders/realtime/orders.gateway';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

const dec = (n: number) => ({ toNumber: () => n });

const FUTURE = new Date('2100-01-01T00:00:00Z');
const PAST = new Date('2020-01-01T00:00:00Z');

describe('OnlineOrdersService', () => {
  let service: OnlineOrdersService;
  let prisma: {
    branch: { findUnique: jest.Mock };
    onlineOrder: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let ordersService: { create: jest.Mock };
  let gateway: { emitOnlineOrderResolved: jest.Mock };

  const cajero: CurrentUserPayload = {
    id: 'u1',
    email: 'cajero@pippo.local',
    role: 'cajero',
    branch_id: 'br1',
    full_name: 'Cajero',
    business_id: 'biz1',
    enabled_modules: { ...DEFAULT_ENABLED_MODULES, onlineOrders: true },
  };
  const sinModulo: CurrentUserPayload = {
    ...cajero,
    enabled_modules: DEFAULT_ENABLED_MODULES,
  };

  const storedOrder = (over: Record<string, unknown> = {}) => ({
    id: 'oo1',
    publicToken: 'abcdef1234567890',
    branchId: 'br1',
    customerName: 'Juan Pérez',
    customerPhone: '+59171234567',
    total: dec(150),
    status: 'pending',
    notes: null,
    rejectReason: null,
    createdAt: new Date('2026-10-26T12:00:00Z'),
    expiresAt: FUTURE,
    resolvedAt: null,
    orderId: null,
    order: null,
    items: [{ variantId: 'v1', qty: 2, unitPrice: dec(75) }],
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }),
      },
      onlineOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(storedOrder()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    ordersService = {
      create: jest.fn().mockResolvedValue({
        order_id: 'ord-1',
        daily_number: 42,
        duplicate: false,
      }),
    };
    gateway = { emitOnlineOrderResolved: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnlineOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrdersService, useValue: ordersService },
        { provide: OrdersGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(OnlineOrdersService);
  });

  describe('guard de módulo', () => {
    it('rechaza listar, confirmar y rechazar si el negocio no tiene el módulo', async () => {
      await expect(service.list('br1', sinModulo)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.confirm('oo1', sinModulo)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.reject('oo1', { reason: 'no hay stock' }, sinModulo),
      ).rejects.toThrow(ForbiddenException);
      expect(ordersService.create).not.toHaveBeenCalled();
    });
  });

  describe('aislamiento entre negocios', () => {
    it('no deja confirmar un pedido de otro negocio', async () => {
      prisma.branch.findUnique.mockResolvedValue({
        businessId: 'OTRO-NEGOCIO',
      });

      await expect(service.confirm('oo1', cajero)).rejects.toThrow(
        NotFoundException,
      );
      expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('no deja listar una sucursal de otro negocio', async () => {
      prisma.branch.findUnique.mockResolvedValue({
        businessId: 'OTRO-NEGOCIO',
      });
      await expect(service.list('br-ajena', cajero)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('filtra vencidos al listar, sin depender del cron', async () => {
      await service.list('br1', cajero);

      const where = prisma.onlineOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('pending');
      expect(where.expiresAt.gt).toBeInstanceOf(Date);
      expect(where.branchId).toBe('br1');
    });

    it('mapea la referencia corta y los items', async () => {
      prisma.onlineOrder.findMany.mockResolvedValue([
        storedOrder({
          items: [
            {
              variantId: 'v1',
              qty: 2,
              unitPrice: dec(75),
              variant: { name: 'Grande', product: { name: 'Napolitana' } },
            },
          ],
        }),
      ]);

      const [result] = await service.list('br1', cajero);

      expect(result.reference).toBe('ABCDEF');
      expect(result.customer_phone).toBe('+59171234567');
      expect(result.items).toEqual([
        {
          variant_id: 'v1',
          product_name: 'Napolitana',
          variant_name: 'Grande',
          qty: 2,
          unit_price: 75,
        },
      ]);
    });
  });

  describe('confirm', () => {
    it('crea la venta por el flujo normal, como online y SIN cobrar', async () => {
      await service.confirm('oo1', cajero);

      const [dto, user] = ordersService.create.mock.calls[0];
      expect(dto.order_type).toBe('online');
      expect(dto.branch_id).toBe('br1');
      expect(dto.total).toBe(150);
      expect(dto.items).toEqual([{ variant_id: 'v1', qty: 2 }]);
      // Lo que hace que nazca "por cobrar": sin método de pago, OrdersService
      // deja paid_by en null.
      expect(dto.payment_method).toBeUndefined();
      expect(dto.payments).toBeUndefined();
      expect(user).toBe(cajero);
    });

    it('devuelve el id y el número de la venta creada', async () => {
      const result = await service.confirm('oo1', cajero);
      expect(result).toEqual({ order_id: 'ord-1', daily_number: 42 });
    });

    // Doble click, dos cajeros a la vez, o un retry tras timeout: la misma
    // key colapsa todo en UNA venta (create_order_atomic devuelve la existente).
    it('usa una idempotency key derivada del pedido, no aleatoria', async () => {
      await service.confirm('oo1', cajero);
      expect(ordersService.create.mock.calls[0][0].idempotency_key).toBe(
        'online-oo1',
      );
    });

    it('pone nombre y teléfono del cliente en las notas de la venta', async () => {
      await service.confirm('oo1', cajero);

      const notes = ordersService.create.mock.calls[0][0].notes;
      expect(notes).toContain('#ABCDEF');
      expect(notes).toContain('Juan Pérez');
      expect(notes).toContain('+59171234567');
    });

    it('suma la nota del cliente si dejó una', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(
        storedOrder({ notes: 'sin cebolla' }),
      );

      await service.confirm('oo1', cajero);

      expect(ordersService.create.mock.calls[0][0].notes).toContain(
        'sin cebolla',
      );
    });

    // El campo notes tiene límite de 300 en el DTO de orders.
    it('recorta las notas a 300 caracteres', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(
        storedOrder({ notes: 'x'.repeat(500) }),
      );

      await service.confirm('oo1', cajero);

      expect(ordersService.create.mock.calls[0][0].notes.length).toBe(300);
    });

    it('marca el pedido como confirmado y lo liga a la venta', async () => {
      await service.confirm('oo1', cajero);

      const call = prisma.onlineOrder.updateMany.mock.calls[0][0];
      // Condicional sobre status pending: así una carrera no sobreescribe.
      expect(call.where).toEqual({ id: 'oo1', status: 'pending' });
      expect(call.data).toMatchObject({
        status: 'confirmed',
        orderId: 'ord-1',
        resolvedBy: 'u1',
      });
      expect(gateway.emitOnlineOrderResolved).toHaveBeenCalledWith('br1', {
        id: 'oo1',
        status: 'confirmed',
      });
    });

    it('404 si el pedido no existe', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(null);
      await expect(service.confirm('nope', cajero)).rejects.toThrow(
        NotFoundException,
      );
    });

    // EL borde que importa: el cajero aprieta Confirmar justo al vencer.
    it('no crea ninguna venta si el pedido ya venció', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue(
        storedOrder({ expiresAt: PAST }),
      );

      await expect(service.confirm('oo1', cajero)).rejects.toThrow(
        'Este pedido venció y ya no se puede confirmar',
      );
      expect(ordersService.create).not.toHaveBeenCalled();
      expect(prisma.onlineOrder.updateMany).not.toHaveBeenCalled();
    });

    it.each(['confirmed', 'rejected', 'expired'])(
      'no vuelve a crear venta si el pedido ya está %s',
      async (status) => {
        prisma.onlineOrder.findUnique.mockResolvedValue(
          storedOrder({ status }),
        );

        await expect(service.confirm('oo1', cajero)).rejects.toThrow(
          ConflictException,
        );
        expect(ordersService.create).not.toHaveBeenCalled();
      },
    );

    // Dos cajeros pasan la validación y los dos llaman a create: la key
    // compartida hace que sea la MISMA venta, y el segundo update no pisa nada.
    it('si otro usuario ganó la carrera, no emite ni duplica, pero devuelve la venta', async () => {
      prisma.onlineOrder.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.confirm('oo1', cajero);

      expect(result).toEqual({ order_id: 'ord-1', daily_number: 42 });
      expect(gateway.emitOnlineOrderResolved).not.toHaveBeenCalled();
    });

    // Si OrdersService rechaza (precio cambió, variante inactiva), el pedido
    // tiene que quedar INTACTO en pending para que se pueda rechazar a mano.
    it('no marca nada si la creación de la venta falla', async () => {
      ordersService.create.mockRejectedValue(
        new Error('Los precios cambiaron'),
      );

      await expect(service.confirm('oo1', cajero)).rejects.toThrow(
        'Los precios cambiaron',
      );
      expect(prisma.onlineOrder.updateMany).not.toHaveBeenCalled();
      expect(gateway.emitOnlineOrderResolved).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('guarda el motivo recortado y avisa por socket', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue({
        id: 'oo1',
        branchId: 'br1',
        status: 'pending',
        expiresAt: FUTURE,
      });

      await service.reject(
        'oo1',
        { reason: '  sin stock de mozzarella  ' },
        cajero,
      );

      const call = prisma.onlineOrder.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'oo1', status: 'pending' });
      expect(call.data).toMatchObject({
        status: 'rejected',
        rejectReason: 'sin stock de mozzarella',
        resolvedBy: 'u1',
      });
      expect(gateway.emitOnlineOrderResolved).toHaveBeenCalledWith('br1', {
        id: 'oo1',
        status: 'rejected',
      });
    });

    // Rechazar un vencido SÍ se permite: el negocio igual quiere decirle al
    // cliente por qué, y un motivo le sirve más que un "venció" pelado.
    it('permite rechazar un pedido vencido que todavía está pending', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue({
        id: 'oo1',
        branchId: 'br1',
        status: 'pending',
        expiresAt: PAST,
      });

      await expect(
        service.reject('oo1', { reason: 'nadie lo atendió' }, cajero),
      ).resolves.toBeUndefined();
    });

    it('no deja rechazar uno ya resuelto', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue({
        id: 'oo1',
        branchId: 'br1',
        status: 'confirmed',
        expiresAt: FUTURE,
      });

      await expect(
        service.reject('oo1', { reason: 'tarde' }, cajero),
      ).rejects.toThrow(ConflictException);
      expect(prisma.onlineOrder.updateMany).not.toHaveBeenCalled();
    });

    it('si pierde la carrera del update, falla en vez de mentir', async () => {
      prisma.onlineOrder.findUnique.mockResolvedValue({
        id: 'oo1',
        branchId: 'br1',
        status: 'pending',
        expiresAt: FUTURE,
      });
      prisma.onlineOrder.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reject('oo1', { reason: 'tarde' }, cajero),
      ).rejects.toThrow(ConflictException);
      expect(gateway.emitOnlineOrderResolved).not.toHaveBeenCalled();
    });
  });

  describe('expireOverdue (cron)', () => {
    it('no escribe nada si no hay vencidos', async () => {
      prisma.onlineOrder.findMany.mockResolvedValue([]);

      await service.expireOverdue();

      expect(prisma.onlineOrder.updateMany).not.toHaveBeenCalled();
      expect(gateway.emitOnlineOrderResolved).not.toHaveBeenCalled();
    });

    it('marca expired solo lo que sigue pending y avisa por sucursal', async () => {
      prisma.onlineOrder.findMany.mockResolvedValue([
        { id: 'oo1', branchId: 'br1' },
        { id: 'oo2', branchId: 'br2' },
      ]);
      prisma.onlineOrder.updateMany.mockResolvedValue({ count: 2 });

      await service.expireOverdue();

      const call = prisma.onlineOrder.updateMany.mock.calls[0][0];
      expect(call.where).toMatchObject({
        id: { in: ['oo1', 'oo2'] },
        status: 'pending',
      });
      expect(call.data.status).toBe('expired');
      expect(gateway.emitOnlineOrderResolved).toHaveBeenCalledWith('br1', {
        id: 'oo1',
        status: 'expired',
      });
      expect(gateway.emitOnlineOrderResolved).toHaveBeenCalledWith('br2', {
        id: 'oo2',
        status: 'expired',
      });
    });

    // Varias instancias del backend corren el mismo cron: la segunda no
    // encuentra nada que mover y no debe avisar de nuevo.
    it('no avisa si otra instancia ya los movió', async () => {
      prisma.onlineOrder.findMany.mockResolvedValue([
        { id: 'oo1', branchId: 'br1' },
      ]);
      prisma.onlineOrder.updateMany.mockResolvedValue({ count: 0 });

      await service.expireOverdue();

      expect(gateway.emitOnlineOrderResolved).not.toHaveBeenCalled();
    });

    it('solo busca pendientes con plazo cumplido', async () => {
      await service.expireOverdue();

      const where = prisma.onlineOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('pending');
      expect(where.expiresAt.lte).toBeInstanceOf(Date);
    });
  });
});
