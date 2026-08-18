import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductStockService } from './product-stock.service';
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

describe('ProductStockService', () => {
  let service: ProductStockService;
  let prisma: {
    branch: { findUnique: jest.Mock };
    branchProductStock: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    productStockMovement: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    productVariant: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }),
      },
      branchProductStock: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      productStockMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      productVariant: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductStockService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ProductStockService);
  });

  describe('list', () => {
    it('filtra las filas cuyo producto está inactivo', async () => {
      prisma.branchProductStock.findMany.mockResolvedValue([
        {
          id: 's1',
          variantId: 'v1',
          quantity: decimal(5),
          minQuantity: decimal(1),
          variant: {
            id: 'v1',
            name: 'Lata',
            basePrice: decimal(10),
            product: { id: 'p1', name: 'Coca-Cola', isActive: true },
          },
        },
        {
          id: 's2',
          variantId: 'v2',
          quantity: decimal(3),
          minQuantity: decimal(1),
          variant: {
            id: 'v2',
            name: 'Botella',
            basePrice: decimal(15),
            product: { id: 'p2', name: 'Discontinuado', isActive: false },
          },
        },
      ]);

      const result = await service.list({ branchId: 'b1' }, admin);

      expect(result.total).toBe(1);
      expect(result.data[0].variant_id).toBe('v1');
      expect(result.data[0].product_variants).toEqual({
        id: 'v1',
        name: 'Lata',
        base_price: 10,
        products: { id: 'p1', name: 'Coca-Cola' },
      });
      expect(prisma.branchProductStock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branch: { businessId: 'biz1' }, branchId: 'b1' },
        }),
      );
    });
  });

  describe('getResaleVariants', () => {
    it('mapea las variantes de reventa activas', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'v1', name: 'Lata', product: { id: 'p1', name: 'Coca-Cola' } },
      ]);

      const result = await service.getResaleVariants(admin);

      expect(result).toEqual([
        { id: 'v1', name: 'Lata', products: { id: 'p1', name: 'Coca-Cola' } },
      ]);
      expect(prisma.productVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            isActive: true,
            product: { isActive: true, productType: 'resale' },
          },
        }),
      );
    });
  });

  describe('purchase', () => {
    it('suma la cantidad si ya existe stock para esa variante en la sucursal', async () => {
      prisma.branchProductStock.findUnique.mockResolvedValue({
        id: 's1',
        quantity: decimal(5),
      });

      await service.purchase(
        { branch_id: 'b1', variant_id: 'v1', quantity: 3 },
        admin,
      );

      expect(prisma.branchProductStock.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { quantity: 8, updatedAt: expect.any(Date) },
      });
      expect(prisma.productStockMovement.create).toHaveBeenCalledWith({
        data: {
          branchId: 'b1',
          variantId: 'v1',
          quantity: 3,
          type: 'compra',
          createdBy: 'u1',
        },
      });
    });

    it('crea el registro de stock si no existía', async () => {
      prisma.branchProductStock.findUnique.mockResolvedValue(null);

      await service.purchase(
        { branch_id: 'b1', variant_id: 'v1', quantity: 3, min_quantity: 1 },
        admin,
      );

      expect(prisma.branchProductStock.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', variantId: 'v1', quantity: 3, minQuantity: 1 },
      });
    });

    it('rechaza con 404 si la sucursal pertenece a otro negocio', async () => {
      prisma.branch.findUnique.mockResolvedValue({
        businessId: 'otro-negocio',
      });

      await expect(
        service.purchase(
          { branch_id: 'b1', variant_id: 'v1', quantity: 3 },
          admin,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.branchProductStock.create).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    it('calcula la diferencia y la registra como ajuste', async () => {
      prisma.branchProductStock.findUnique.mockResolvedValue({
        id: 's1',
        quantity: decimal(10),
      });

      const result = await service.adjust(
        { branch_id: 'b1', variant_id: 'v1', real_quantity: 7 },
        admin,
      );

      expect(prisma.branchProductStock.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { quantity: 7, updatedAt: expect.any(Date) },
      });
      expect(result).toEqual({ difference: -3 });
    });

    it('crea la fila si el producto nunca pasó por bodega/transferencia en esta sucursal', async () => {
      prisma.branchProductStock.findUnique.mockResolvedValue(null);

      const result = await service.adjust(
        { branch_id: 'b1', variant_id: 'v1', real_quantity: 5 },
        admin,
      );

      expect(prisma.branchProductStock.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', variantId: 'v1', quantity: 5, minQuantity: 0 },
      });
      expect(result).toEqual({ difference: 5 });
    });
  });

  describe('updateMinQuantity', () => {
    it('actualiza min_quantity por id', async () => {
      prisma.branchProductStock.findUnique.mockResolvedValue({
        branch: { businessId: 'biz1' },
      });

      await service.updateMinQuantity('s1', 4, admin);

      expect(prisma.branchProductStock.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { minQuantity: 4 },
      });
    });

    it('rechaza con 404 si el registro pertenece a otro negocio', async () => {
      prisma.branchProductStock.findUnique.mockResolvedValue({
        branch: { businessId: 'otro-negocio' },
      });

      await expect(service.updateMinQuantity('s1', 4, admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.branchProductStock.update).not.toHaveBeenCalled();
    });
  });
});
