import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

describe('IngredientsService', () => {
  let service: IngredientsService;
  let prisma: {
    ingredient: { findMany: jest.Mock; findUnique: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
    recipe: { count: jest.Mock };
  };

  const admin: CurrentUserPayload = {
    id: 'u1',
    email: 'admin@pippo.local',
    role: 'admin',
    branch_id: null,
    full_name: 'Admin',
    business_id: 'biz1',
  };

  beforeEach(async () => {
    prisma = {
      ingredient: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      recipe: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [IngredientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(IngredientsService);
  });

  describe('list', () => {
    it('filtra por is_active=true cuando showInactive no viene', async () => {
      prisma.ingredient.findMany.mockResolvedValue([]);
      prisma.ingredient.count.mockResolvedValue(0);

      await service.list({}, admin);

      expect(prisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', isActive: true } }),
      );
    });

    it('incluye inactivos cuando showInactive=true', async () => {
      prisma.ingredient.findMany.mockResolvedValue([]);
      prisma.ingredient.count.mockResolvedValue(0);

      await service.list({ showInactive: 'true' }, admin);

      expect(prisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });

    it('mapea las filas al shape de @pippo/shared con fechas como string', async () => {
      prisma.ingredient.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'Harina',
          unit: 'kg',
          isActive: true,
          isSharedUse: false,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      prisma.ingredient.count.mockResolvedValue(1);

      const result = await service.list({}, admin);

      expect(result.data).toEqual([
        {
          id: '1',
          name: 'Harina',
          unit: 'kg',
          created_at: '2026-01-01T00:00:00.000Z',
          is_active: true,
          is_shared_use: false,
        },
      ]);
      expect(result.total).toBe(1);
    });
  });

  describe('create', () => {
    it('crea con is_shared_use=false por defecto si no se envía', async () => {
      prisma.ingredient.create.mockResolvedValue({ id: '1' });

      await service.create({ name: 'Caja Familiar', unit: 'unidad' }, admin);

      expect(prisma.ingredient.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', name: 'Caja Familiar', unit: 'unidad', isSharedUse: false },
      });
    });

    it('crea con is_shared_use=true cuando se envía', async () => {
      prisma.ingredient.create.mockResolvedValue({ id: '1' });

      await service.create({ name: 'Caja Familiar', unit: 'unidad', is_shared_use: true }, admin);

      expect(prisma.ingredient.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', name: 'Caja Familiar', unit: 'unidad', isSharedUse: true },
      });
    });
  });

  describe('update', () => {
    it('bloquea la desactivación si el insumo está en recetas activas', async () => {
      prisma.recipe.count.mockResolvedValue(2);

      await expect(service.update('1', { is_active: false }, admin)).rejects.toThrow(ConflictException);
      expect(prisma.ingredient.update).not.toHaveBeenCalled();
    });

    it('permite la desactivación si no hay recetas activas', async () => {
      prisma.recipe.count.mockResolvedValue(0);

      await service.update('1', { is_active: false }, admin);

      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
      });
    });

    it('no chequea recetas si no se está desactivando', async () => {
      await service.update('1', { name: 'Harina 000' }, admin);

      expect(prisma.recipe.count).not.toHaveBeenCalled();
      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'Harina 000' },
      });
    });

    it('actualiza is_shared_use cuando se envía', async () => {
      await service.update('1', { is_shared_use: true }, admin);

      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isSharedUse: true },
      });
    });

    it('rechaza con 404 si el insumo pertenece a otro negocio', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.update('1', { name: 'Harina 000' }, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.ingredient.update).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('bloquea el borrado si el insumo está en recetas activas', async () => {
      prisma.recipe.count.mockResolvedValue(1);

      await expect(service.softDelete('1', admin)).rejects.toThrow(ConflictException);
      expect(prisma.ingredient.update).not.toHaveBeenCalled();
    });

    it('marca is_active=false si no hay recetas activas', async () => {
      prisma.recipe.count.mockResolvedValue(0);

      await service.softDelete('1', admin);

      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
      });
    });

    it('rechaza con 404 si el insumo pertenece a otro negocio', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.softDelete('1', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.ingredient.update).not.toHaveBeenCalled();
    });
  });
});
