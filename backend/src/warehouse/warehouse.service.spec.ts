import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseService } from './warehouse.service';
import { InsufficientStockException } from '../common/exceptions/insufficient-stock.exception';
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

describe('WarehouseService', () => {
  let service: WarehouseService;
  let prisma: {
    warehouseStock: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock; create: jest.Mock; delete: jest.Mock };
    warehouseMovement: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock };
    branchStock: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    stockMovement: { create: jest.Mock };
    ingredient: { findUnique: jest.Mock };
    branch: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      warehouseStock: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), delete: jest.fn() },
      warehouseMovement: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      branchStock: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      stockMovement: { create: jest.fn() },
      ingredient: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) },
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WarehouseService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(WarehouseService);
  });

  describe('list', () => {
    it('marca has_movements según si el insumo tiene movimientos registrados', async () => {
      prisma.warehouseStock.findMany.mockResolvedValue([
        { id: 's1', ingredientId: 'i1', quantity: decimal(5), minQuantity: decimal(1), updatedAt: new Date('2026-01-01'), ingredient: { name: 'Harina', unit: 'kg' } },
        { id: 's2', ingredientId: 'i2', quantity: decimal(3), minQuantity: decimal(1), updatedAt: new Date('2026-01-01'), ingredient: { name: 'Queso', unit: 'kg' } },
      ]);
      prisma.warehouseStock.count.mockResolvedValue(2);
      prisma.warehouseMovement.findMany.mockResolvedValue([{ ingredientId: 'i1' }]);

      const result = await service.list({}, admin);

      expect(result.data.find((r) => r.ingredient_id === 'i1')?.has_movements).toBe(true);
      expect(result.data.find((r) => r.ingredient_id === 'i2')?.has_movements).toBe(false);
      expect(prisma.warehouseStock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', ingredient: { isActive: true } } }),
      );
    });

    it('filtra por status=low', async () => {
      prisma.warehouseStock.findMany.mockResolvedValue([
        { id: 's1', ingredientId: 'i1', quantity: decimal(1), minQuantity: decimal(5), updatedAt: new Date(), ingredient: { name: 'Harina', unit: 'kg' } },
        { id: 's2', ingredientId: 'i2', quantity: decimal(10), minQuantity: decimal(5), updatedAt: new Date(), ingredient: { name: 'Queso', unit: 'kg' } },
      ]);
      prisma.warehouseStock.count.mockResolvedValue(2);
      prisma.warehouseMovement.findMany.mockResolvedValue([]);

      const result = await service.list({ status: 'low' }, admin);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ingredient_id).toBe('i1');
    });
  });

  describe('updateMinQuantity', () => {
    it('rechaza con 404 si no existe', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue(null);

      await expect(service.updateMinQuantity('missing', { min_quantity: 5 }, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.warehouseStock.update).not.toHaveBeenCalled();
    });

    it('actualiza min_quantity si existe', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', businessId: 'biz1' });

      await service.updateMinQuantity('s1', { min_quantity: 5 }, admin);

      expect(prisma.warehouseStock.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { minQuantity: 5 },
      });
    });

    it('rechaza con 404 si el insumo pertenece a otro negocio', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', businessId: 'otro-negocio' });

      await expect(service.updateMinQuantity('s1', { min_quantity: 5 }, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.warehouseStock.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('rechaza con 409 si el insumo tiene movimientos registrados', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', ingredientId: 'i1', businessId: 'biz1' });
      prisma.warehouseMovement.count.mockResolvedValue(3);

      await expect(service.remove('s1', admin)).rejects.toThrow(ConflictException);
      expect(prisma.warehouseStock.delete).not.toHaveBeenCalled();
    });

    it('rechaza con 404 si no existe', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', admin)).rejects.toThrow(NotFoundException);
    });

    it('elimina si no tiene movimientos', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', ingredientId: 'i1', businessId: 'biz1' });
      prisma.warehouseMovement.count.mockResolvedValue(0);

      await service.remove('s1', admin);

      expect(prisma.warehouseStock.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('rechaza con 404 si el insumo pertenece a otro negocio', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', ingredientId: 'i1', businessId: 'otro-negocio' });

      await expect(service.remove('s1', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.warehouseStock.delete).not.toHaveBeenCalled();
    });
  });

  describe('purchase', () => {
    it('rechaza cantidad <= 0', async () => {
      await expect(service.purchase({ ingredient_id: 'i1', quantity: 0 }, admin)).rejects.toThrow(BadRequestException);
    });

    it('suma al stock existente y registra movimiento compra', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(5) });

      await service.purchase({ ingredient_id: 'i1', quantity: 3 }, admin);

      expect(prisma.warehouseStock.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { quantity: 8, updatedAt: expect.any(Date) },
      });
      expect(prisma.warehouseMovement.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ingredientId: 'i1', quantity: 3, type: 'compra', branchId: null, notes: null, createdBy: 'u1' },
      });
    });

    it('rechaza con 404 si el insumo pertenece a otro negocio', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.purchase({ ingredient_id: 'i1', quantity: 3 }, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.warehouseStock.update).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    it('rechaza cantidad negativa', async () => {
      await expect(service.adjust({ ingredient_id: 'i1', real_quantity: -1 }, admin)).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 404 si el insumo no está en bodega', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue(null);

      await expect(service.adjust({ ingredient_id: 'i1', real_quantity: 5 }, admin)).rejects.toThrow(NotFoundException);
    });

    it('calcula la diferencia correctamente', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(10) });

      const result = await service.adjust({ ingredient_id: 'i1', real_quantity: 7 }, admin);

      expect(result).toEqual({ difference: -3 });
    });
  });

  describe('transfer', () => {
    it('rechaza si no hay stock suficiente, con el disponible en la excepción', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(2) });

      await expect(service.transfer({ ingredient_id: 'i1', quantity: 5, branch_id: 'b1' }, admin)).rejects.toThrow(
        InsufficientStockException,
      );
    });

    it('descuenta de bodega, suma a la sucursal y registra ambos movimientos', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(10) });
      prisma.branchStock.findFirst.mockResolvedValue(null);

      await service.transfer({ ingredient_id: 'i1', quantity: 4, branch_id: 'b1' }, admin);

      expect(prisma.warehouseStock.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { quantity: 6, updatedAt: expect.any(Date) },
      });
      expect(prisma.branchStock.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', ingredientId: 'i1', quantity: 4, minQuantity: 0 },
      });
      expect(prisma.warehouseMovement.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ingredientId: 'i1', quantity: -4, type: 'transferencia', branchId: 'b1', notes: null, createdBy: 'u1' },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', ingredientId: 'i1', quantity: 4, type: 'compra', origin: 'transferencia', notes: null, createdBy: 'u1' },
      });
    });

    it('rechaza con 404 si la sucursal destino pertenece a otro negocio', async () => {
      prisma.warehouseStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(10) });
      prisma.branch.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.transfer({ ingredient_id: 'i1', quantity: 4, branch_id: 'b1' }, admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.warehouseStock.update).not.toHaveBeenCalled();
    });
  });
});
