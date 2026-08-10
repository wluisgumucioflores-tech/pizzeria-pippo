import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseProductService } from './warehouse-product.service';
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

describe('WarehouseProductService', () => {
  let service: WarehouseProductService;
  let prisma: {
    warehouseProductStock: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    warehouseProductMovement: { findMany: jest.Mock; create: jest.Mock };
    branchProductStock: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    productStockMovement: { create: jest.Mock };
    productVariant: { findUnique: jest.Mock };
    branch: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      warehouseProductStock: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      warehouseProductMovement: { findMany: jest.fn(), create: jest.fn() },
      branchProductStock: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      productStockMovement: { create: jest.fn() },
      productVariant: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) },
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WarehouseProductService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(WarehouseProductService);
  });

  describe('list', () => {
    it('filtra las filas cuyo producto está inactivo', async () => {
      prisma.warehouseProductStock.findMany.mockResolvedValue([
        { id: 's1', variantId: 'v1', quantity: decimal(5), minQuantity: decimal(1), variant: { id: 'v1', name: 'Lata', product: { id: 'p1', name: 'Coca-Cola', isActive: true } } },
        { id: 's2', variantId: 'v2', quantity: decimal(3), minQuantity: decimal(1), variant: { id: 'v2', name: 'Botella', product: { id: 'p2', name: 'Discontinuado', isActive: false } } },
      ]);

      const result = await service.list(admin);

      expect(result.total).toBe(1);
      expect(result.data[0].variant_id).toBe('v1');
      expect(prisma.warehouseProductStock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });
  });

  describe('purchase', () => {
    it('rechaza cantidad <= 0', async () => {
      await expect(service.purchase({ variant_id: 'v1', quantity: 0 }, admin)).rejects.toThrow(BadRequestException);
    });

    it('crea el registro si no existía', async () => {
      prisma.warehouseProductStock.findUnique.mockResolvedValue(null);

      await service.purchase({ variant_id: 'v1', quantity: 5, min_quantity: 2 }, admin);

      expect(prisma.warehouseProductStock.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', variantId: 'v1', quantity: 5, minQuantity: 2 },
      });
    });

    it('rechaza con 404 si la variante pertenece a otro negocio', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.purchase({ variant_id: 'v1', quantity: 5 }, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.warehouseProductStock.create).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    it('rechaza con 404 si no hay stock de bodega para esa variante', async () => {
      prisma.warehouseProductStock.findUnique.mockResolvedValue(null);

      await expect(service.adjust({ variant_id: 'v1', real_quantity: 5 }, admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('transfer', () => {
    it('rechaza si no hay stock suficiente', async () => {
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(2) });

      await expect(service.transfer({ variant_id: 'v1', quantity: 5, branch_id: 'b1' }, admin)).rejects.toThrow(
        InsufficientStockException,
      );
    });

    it('descuenta de bodega, suma a la sucursal (upsert) y registra ambos movimientos', async () => {
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(10) });
      prisma.branchProductStock.findUnique.mockResolvedValue({ id: 'bp1', quantity: decimal(2) });

      await service.transfer({ variant_id: 'v1', quantity: 4, branch_id: 'b1' }, admin);

      expect(prisma.warehouseProductStock.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { quantity: 6, updatedAt: expect.any(Date) },
      });
      expect(prisma.branchProductStock.update).toHaveBeenCalledWith({
        where: { id: 'bp1' },
        data: { quantity: 6, updatedAt: expect.any(Date) },
      });
      expect(prisma.warehouseProductMovement.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', variantId: 'v1', quantity: -4, type: 'transferencia', branchId: 'b1', notes: null, createdBy: 'u1' },
      });
      expect(prisma.productStockMovement.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', variantId: 'v1', quantity: 4, type: 'compra', notes: null, createdBy: 'u1' },
      });
    });

    it('rechaza con 404 si la sucursal destino pertenece a otro negocio', async () => {
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 's1', quantity: decimal(10) });
      prisma.branch.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(
        service.transfer({ variant_id: 'v1', quantity: 4, branch_id: 'b1' }, admin),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.warehouseProductStock.update).not.toHaveBeenCalled();
    });
  });
});
