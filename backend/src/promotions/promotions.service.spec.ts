import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

function decimal(value: number) {
  return { toNumber: () => value };
}

const admin: CurrentUserPayload = {
  id: 'u1',
  email: 'admin@pippo.local',
  role: 'admin',
  branch_id: null,
  full_name: 'Admin',
  business_id: 'biz1',
};

function baseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    name: '2x1 Pizza',
    type: 'BUY_X_GET_Y',
    daysOfWeek: [],
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    branchId: null,
    active: true,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    rules: [],
    ...overrides,
  };
}

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: {
    promotion: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    promotionRule: { createMany: jest.Mock; deleteMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      promotion: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }),
        create: jest.fn(),
        update: jest.fn(),
      },
      promotionRule: { createMany: jest.fn(), deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PromotionsService);
  });

  describe('list', () => {
    it('filtra por is_active=true cuando showInactive no viene', async () => {
      prisma.promotion.findMany.mockResolvedValue([]);

      await service.list({}, admin);

      expect(prisma.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', isActive: true } }),
      );
    });

    it('mapea days_of_week, fechas como YYYY-MM-DD y Decimal a number en las reglas', async () => {
      prisma.promotion.findMany.mockResolvedValue([
        baseRow({
          rules: [
            { id: 'r1', promotionId: 'p1', variantId: 'v1', buyQty: 2, getQty: 1, discountPercent: null, comboPrice: null, category: null, variantSize: null },
          ],
        }),
      ]);

      const result = await service.list({}, admin);

      expect(result[0].start_date).toBe('2026-01-01');
      expect(result[0].end_date).toBe('2026-12-31');
      expect(result[0].promotion_rules[0]).toEqual({
        id: 'r1', promotion_id: 'p1', variant_id: 'v1', buy_qty: 2, get_qty: 1,
        discount_percent: null, combo_price: null, category: null, variant_size: null,
      });
    });

    it('filtra por sucursal y fecha cuando vienen branchId+date (uso del POS)', async () => {
      prisma.promotion.findMany.mockResolvedValue([
        baseRow({ id: 'p1', branchId: 'b1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }),
        baseRow({ id: 'p2', branchId: 'b2', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }),
        baseRow({ id: 'p3', branchId: null, active: false, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }),
      ]);

      const result = await service.list({ branchId: 'b1', date: '2026-07-03' }, admin);

      expect(result.map((p) => p.id)).toEqual(['p1']);
    });

    it('respeta days_of_week al filtrar por fecha', async () => {
      // 2026-07-03 is a Friday (day 5)
      prisma.promotion.findMany.mockResolvedValue([
        baseRow({ id: 'p1', daysOfWeek: [1, 2, 3], startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }),
        baseRow({ id: 'p2', daysOfWeek: [5], startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }),
      ]);

      const result = await service.list({ branchId: 'b1', date: '2026-07-03' }, admin);

      expect(result.map((p) => p.id)).toEqual(['p2']);
    });
  });

  describe('getById', () => {
    it('lanza 404 si no existe', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing', admin)).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si la promoción pertenece a otro negocio', async () => {
      prisma.promotion.findUnique.mockResolvedValue({ ...baseRow(), businessId: 'otro-negocio' });

      await expect(service.getById('p1', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('crea la promoción activa y sus reglas', async () => {
      prisma.promotion.create.mockResolvedValue({ id: 'p1' });

      await service.create(
        {
          name: '2x1',
          type: 'BUY_X_GET_Y',
          days_of_week: [1, 2],
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          rules: [{ variant_id: 'v1', buy_qty: 2, get_qty: 1 }],
        } as never,
        admin,
      );

      expect(prisma.promotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessId: 'biz1', name: '2x1', active: true }),
      });
      expect(prisma.promotionRule.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ businessId: 'biz1', promotionId: 'p1', variantId: 'v1', buyQty: 2, getQty: 1 })],
      });
    });
  });

  describe('update', () => {
    it('borra y recrea las reglas (config reemplazable)', async () => {
      prisma.promotion.update.mockResolvedValue({ id: 'p1', businessId: 'biz1' });

      await service.update('p1', {
        name: '2x1', type: 'BUY_X_GET_Y', days_of_week: [], start_date: '2026-01-01', end_date: '2026-12-31',
        active: true, rules: [{ variant_id: 'v1', buy_qty: 2, get_qty: 1 }],
      } as never, admin);

      expect(prisma.promotionRule.deleteMany).toHaveBeenCalledWith({ where: { promotionId: 'p1' } });
      expect(prisma.promotionRule.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ businessId: 'biz1', promotionId: 'p1', variantId: 'v1' })],
      });
    });

    it('rechaza con 404 si la promoción pertenece a otro negocio', async () => {
      prisma.promotion.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(
        service.update('p1', {
          name: '2x1', type: 'BUY_X_GET_Y', days_of_week: [], start_date: '2026-01-01', end_date: '2026-12-31',
          active: true, rules: [],
        } as never, admin),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.promotion.update).not.toHaveBeenCalled();
    });
  });

  describe('patch', () => {
    it('solo actualiza los campos enviados (is_active y/o active)', async () => {
      await service.patch('p1', { active: false }, admin);

      expect(prisma.promotion.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { active: false } });
    });

    it('rechaza con 404 si la promoción pertenece a otro negocio', async () => {
      prisma.promotion.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.patch('p1', { active: false }, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.promotion.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('hace soft delete via is_active', async () => {
      await service.remove('p1', admin);

      expect(prisma.promotion.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isActive: false } });
    });

    it('rechaza con 404 si la promoción pertenece a otro negocio', async () => {
      prisma.promotion.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.remove('p1', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.promotion.update).not.toHaveBeenCalled();
    });
  });
});
