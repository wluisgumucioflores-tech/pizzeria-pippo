import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductionService } from './production.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';

function decimal(value: number) {
  return { toNumber: () => value };
}

describe('ProductionService', () => {
  let service: ProductionService;
  let prisma: {
    ingredient: { findUnique: jest.Mock };
    productVariant: { findUnique: jest.Mock };
    productionIngredientLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    productionOutputLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    warehouseProductStock: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    warehouseProductMovement: { create: jest.Mock };
  };
  let settingsService: { getStockControlFlags: jest.Mock };

  const jefeProduccion: CurrentUserPayload = {
    id: 'u1',
    email: 'jefe@pippo.local',
    role: 'produccion',
    branch_id: null,
    full_name: 'Jefe',
    business_id: 'biz1',
    enabled_modules: { ...DEFAULT_ENABLED_MODULES, produccion: true },
  };

  const jefeSinModulo: CurrentUserPayload = {
    ...jefeProduccion,
    enabled_modules: { ...DEFAULT_ENABLED_MODULES, produccion: false },
  };

  beforeEach(async () => {
    prisma = {
      ingredient: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) },
      productVariant: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) },
      productionIngredientLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      productionOutputLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1', variantId: 'var1', quantity: decimal(40) }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      warehouseProductStock: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      warehouseProductMovement: { create: jest.fn() },
    };
    settingsService = {
      getStockControlFlags: jest.fn().mockResolvedValue({ resale: true, insumos: true, madeUnit: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get(ProductionService);
  });

  describe('logIngredientUsage', () => {
    it('crea el registro con el business_id y created_by del usuario', async () => {
      prisma.productionIngredientLog.create.mockResolvedValue({ id: 'log1' });

      const result = await service.logIngredientUsage(
        { ingredient_id: 'ing1', quantity: 5, notes: 'para alfajores' },
        jefeProduccion,
      );

      expect(prisma.productionIngredientLog.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ingredientId: 'ing1', quantity: 5, notes: 'para alfajores', createdBy: 'u1' },
      });
      expect(result).toEqual({ id: 'log1' });
    });

    it('rechaza con 403 si el negocio no tiene el módulo produccion habilitado', async () => {
      await expect(
        service.logIngredientUsage({ ingredient_id: 'ing1', quantity: 5 }, jefeSinModulo),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.productionIngredientLog.create).not.toHaveBeenCalled();
    });

    it('rechaza con 404 si el insumo pertenece a otro negocio', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(
        service.logIngredientUsage({ ingredient_id: 'ing1', quantity: 5 }, jefeProduccion),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.productionIngredientLog.create).not.toHaveBeenCalled();
    });
  });

  describe('updateIngredientUsage', () => {
    it('actualiza el registro si pertenece al negocio', async () => {
      await service.updateIngredientUsage('log1', { ingredient_id: 'ing1', quantity: 8, notes: 'ajustado' }, jefeProduccion);

      expect(prisma.productionIngredientLog.update).toHaveBeenCalledWith({
        where: { id: 'log1' },
        data: { ingredientId: 'ing1', quantity: 8, notes: 'ajustado' },
      });
    });

    it('rechaza con 404 si el registro pertenece a otro negocio', async () => {
      prisma.productionIngredientLog.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(
        service.updateIngredientUsage('log1', { ingredient_id: 'ing1', quantity: 8 }, jefeProduccion),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.productionIngredientLog.update).not.toHaveBeenCalled();
    });

    it('rechaza con 403 si el negocio no tiene el módulo habilitado', async () => {
      await expect(
        service.updateIngredientUsage('log1', { ingredient_id: 'ing1', quantity: 8 }, jefeSinModulo),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteIngredientUsage', () => {
    it('borra el registro si pertenece al negocio', async () => {
      await service.deleteIngredientUsage('log1', jefeProduccion);
      expect(prisma.productionIngredientLog.delete).toHaveBeenCalledWith({ where: { id: 'log1' } });
    });

    it('rechaza con 404 si el registro pertenece a otro negocio', async () => {
      prisma.productionIngredientLog.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.deleteIngredientUsage('log1', jefeProduccion)).rejects.toThrow(NotFoundException);
      expect(prisma.productionIngredientLog.delete).not.toHaveBeenCalled();
    });
  });

  describe('logOutput', () => {
    it('crea el registro con el business_id y created_by del usuario', async () => {
      prisma.productionOutputLog.create.mockResolvedValue({ id: 'log2' });

      const result = await service.logOutput({ variant_id: 'var1', quantity: 40 }, jefeProduccion);

      expect(prisma.productionOutputLog.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', variantId: 'var1', quantity: 40, notes: null, createdBy: 'u1' },
      });
      expect(result).toEqual({ id: 'log2' });
    });

    it('rechaza con 403 si el negocio no tiene el módulo produccion habilitado', async () => {
      await expect(service.logOutput({ variant_id: 'var1', quantity: 40 }, jefeSinModulo)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.productionOutputLog.create).not.toHaveBeenCalled();
    });

    it('rechaza con 404 si la variante pertenece a otro negocio', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.logOutput({ variant_id: 'var1', quantity: 40 }, jefeProduccion)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.productionOutputLog.create).not.toHaveBeenCalled();
    });

    it('con "elaboración por unidad" activo, además suma la cantidad a la bodega (nueva fila)', async () => {
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.productionOutputLog.create.mockResolvedValue({ id: 'log2' });
      prisma.warehouseProductStock.findUnique.mockResolvedValue(null);

      await service.logOutput({ variant_id: 'var1', quantity: 40 }, jefeProduccion);

      expect(prisma.warehouseProductStock.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', variantId: 'var1', quantity: 40, minQuantity: 0 },
      });
      expect(prisma.warehouseProductMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ variantId: 'var1', quantity: 40, type: 'compra' }) }),
      );
    });

    it('con "elaboración por unidad" activo y ya con saldo en bodega, suma sobre el existente', async () => {
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.productionOutputLog.create.mockResolvedValue({ id: 'log2' });
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 'wh1', quantity: decimal(10) });

      await service.logOutput({ variant_id: 'var1', quantity: 40 }, jefeProduccion);

      expect(prisma.warehouseProductStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'wh1' }, data: expect.objectContaining({ quantity: 50 }) }),
      );
    });

    it('con "elaboración por unidad" apagado (default), no toca la bodega', async () => {
      prisma.productionOutputLog.create.mockResolvedValue({ id: 'log2' });

      await service.logOutput({ variant_id: 'var1', quantity: 40 }, jefeProduccion);

      expect(prisma.warehouseProductStock.create).not.toHaveBeenCalled();
      expect(prisma.warehouseProductStock.update).not.toHaveBeenCalled();
    });
  });

  describe('updateOutput', () => {
    it('actualiza el registro si pertenece al negocio', async () => {
      await service.updateOutput('log2', { variant_id: 'var1', quantity: 50 }, jefeProduccion);

      expect(prisma.productionOutputLog.update).toHaveBeenCalledWith({
        where: { id: 'log2' },
        data: { variantId: 'var1', quantity: 50, notes: null },
      });
    });

    it('rechaza con 404 si el registro pertenece a otro negocio', async () => {
      prisma.productionOutputLog.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.updateOutput('log2', { variant_id: 'var1', quantity: 50 }, jefeProduccion)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.productionOutputLog.update).not.toHaveBeenCalled();
    });

    it('con "elaboración por unidad" activo, ajusta la bodega por la diferencia (mismo producto)', async () => {
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.productionOutputLog.findUnique.mockResolvedValue({ businessId: 'biz1', variantId: 'var1', quantity: decimal(40) });
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 'wh1', quantity: decimal(40) });

      await service.updateOutput('log2', { variant_id: 'var1', quantity: 55 }, jefeProduccion);

      expect(prisma.warehouseProductStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 55 }) }),
      );
    });

    it('con "elaboración por unidad" activo y cambio de producto, revierte el viejo y suma al nuevo', async () => {
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.productionOutputLog.findUnique.mockResolvedValue({ businessId: 'biz1', variantId: 'var1', quantity: decimal(40) });
      prisma.warehouseProductStock.findUnique
        .mockResolvedValueOnce({ id: 'wh-var1', quantity: decimal(40) }) // revert de var1
        .mockResolvedValueOnce(null); // alta de var2

      await service.updateOutput('log2', { variant_id: 'var2', quantity: 20 }, jefeProduccion);

      expect(prisma.warehouseProductStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'wh-var1' }, data: expect.objectContaining({ quantity: 0 }) }),
      );
      expect(prisma.warehouseProductStock.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', variantId: 'var2', quantity: 20, minQuantity: 0 },
      });
    });

    it('rechaza si ya se transfirió más stock del que quedaría el registro corregido', async () => {
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.productionOutputLog.findUnique.mockResolvedValue({ businessId: 'biz1', variantId: 'var1', quantity: decimal(40) });
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 'wh1', quantity: decimal(5) });

      await expect(
        service.updateOutput('log2', { variant_id: 'var1', quantity: 10 }, jefeProduccion),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.productionOutputLog.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteOutput', () => {
    it('borra el registro si pertenece al negocio', async () => {
      await service.deleteOutput('log2', jefeProduccion);
      expect(prisma.productionOutputLog.delete).toHaveBeenCalledWith({ where: { id: 'log2' } });
    });

    it('rechaza con 404 si el registro pertenece a otro negocio', async () => {
      prisma.productionOutputLog.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.deleteOutput('log2', jefeProduccion)).rejects.toThrow(NotFoundException);
      expect(prisma.productionOutputLog.delete).not.toHaveBeenCalled();
    });

    it('con "elaboración por unidad" activo, descuenta de bodega la cantidad del registro borrado', async () => {
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.productionOutputLog.findUnique.mockResolvedValue({ businessId: 'biz1', variantId: 'var1', quantity: decimal(40) });
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 'wh1', quantity: decimal(40) });

      await service.deleteOutput('log2', jefeProduccion);

      expect(prisma.warehouseProductStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'wh1' }, data: expect.objectContaining({ quantity: 0 }) }),
      );
      expect(prisma.productionOutputLog.delete).toHaveBeenCalledWith({ where: { id: 'log2' } });
    });

    it('rechaza si ya se transfirió más stock del que hay en el registro a borrar', async () => {
      settingsService.getStockControlFlags.mockResolvedValue({ resale: true, insumos: true, madeUnit: true });
      prisma.productionOutputLog.findUnique.mockResolvedValue({ businessId: 'biz1', variantId: 'var1', quantity: decimal(40) });
      prisma.warehouseProductStock.findUnique.mockResolvedValue({ id: 'wh1', quantity: decimal(5) });

      await expect(service.deleteOutput('log2', jefeProduccion)).rejects.toThrow(BadRequestException);
      expect(prisma.productionOutputLog.delete).not.toHaveBeenCalled();
    });
  });

  describe('listIngredientUsage', () => {
    it('mapea las filas incluyendo insumo y creador', async () => {
      prisma.productionIngredientLog.findMany.mockResolvedValue([
        {
          id: 'log1',
          ingredientId: 'ing1',
          quantity: decimal(5),
          notes: null,
          createdBy: 'u1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          ingredient: { name: 'Harina', unit: 'kg' },
          creator: { fullName: 'Jefe' },
        },
      ]);
      prisma.productionIngredientLog.count.mockResolvedValue(1);

      const result = await service.listIngredientUsage({}, jefeProduccion);

      expect(result.data).toEqual([
        {
          id: 'log1',
          ingredient_id: 'ing1',
          ingredient_name: 'Harina',
          unit: 'kg',
          quantity: 5,
          notes: null,
          created_by: 'u1',
          created_by_name: 'Jefe',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.total).toBe(1);
    });

    it('rechaza con 403 si el negocio no tiene el módulo habilitado', async () => {
      await expect(service.listIngredientUsage({}, jefeSinModulo)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listOutput', () => {
    it('mapea las filas incluyendo producto/variante y creador', async () => {
      prisma.productionOutputLog.findMany.mockResolvedValue([
        {
          id: 'log2',
          variantId: 'var1',
          quantity: decimal(40),
          notes: null,
          createdBy: 'u1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          variant: { name: 'Chico', product: { name: 'Alfajor' } },
          creator: { fullName: 'Jefe' },
        },
      ]);
      prisma.productionOutputLog.count.mockResolvedValue(1);

      const result = await service.listOutput({}, jefeProduccion);

      expect(result.data).toEqual([
        {
          id: 'log2',
          variant_id: 'var1',
          product_name: 'Alfajor',
          variant_name: 'Chico',
          quantity: 40,
          notes: null,
          created_by: 'u1',
          created_by_name: 'Jefe',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.total).toBe(1);
    });

    it('rechaza con 403 si el negocio no tiene el módulo habilitado', async () => {
      await expect(service.listOutput({}, jefeSinModulo)).rejects.toThrow(ForbiddenException);
    });
  });
});
