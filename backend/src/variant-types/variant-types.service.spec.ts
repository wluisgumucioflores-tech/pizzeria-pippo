import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VariantTypesService } from './variant-types.service';
import { VariantTypeInUseException } from '../common/exceptions/variant-type-in-use.exception';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

describe('VariantTypesService', () => {
  let service: VariantTypesService;
  let prisma: {
    variantType: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    productVariant: { count: jest.Mock };
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
      variantType: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1', name: 'Mediana' }), create: jest.fn(), update: jest.fn() },
      productVariant: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [VariantTypesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(VariantTypesService);
  });

  describe('list', () => {
    it('por defecto solo trae tipos activos, ordenados por created_at', async () => {
      prisma.variantType.findMany.mockResolvedValue([]);

      await service.list({}, admin);

      expect(prisma.variantType.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('con onlyActive=false trae también los inactivos', async () => {
      prisma.variantType.findMany.mockResolvedValue([]);

      await service.list({ onlyActive: 'false' }, admin);

      expect(prisma.variantType.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('setActive', () => {
    it('bloquea la desactivación si hay variantes activas usando el tipo', async () => {
      prisma.productVariant.count.mockResolvedValue(3);

      await expect(service.setActive('t1', false, admin)).rejects.toThrow(VariantTypeInUseException);
      expect(prisma.variantType.update).not.toHaveBeenCalled();
    });

    it('permite la desactivación si no hay variantes en uso', async () => {
      prisma.productVariant.count.mockResolvedValue(0);
      prisma.variantType.update.mockResolvedValue({
        id: 't1',
        name: 'Mediana',
        sortOrder: 0,
        isActive: false,
        createdAt: new Date(),
      });

      await service.setActive('t1', false, admin);

      expect(prisma.variantType.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { isActive: false } });
    });

    it('rechaza con 404 si el tipo pertenece a otro negocio', async () => {
      prisma.variantType.findUnique.mockResolvedValue({ businessId: 'otro-negocio', name: 'Mediana' });

      await expect(service.setActive('t1', false, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.variantType.update).not.toHaveBeenCalled();
    });

    it('no chequea uso al reactivar', async () => {
      prisma.variantType.update.mockResolvedValue({
        id: 't1',
        name: 'Mediana',
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
      });

      await service.setActive('t1', true, admin);

      expect(prisma.productVariant.count).not.toHaveBeenCalled();
      expect(prisma.variantType.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { isActive: true } });
    });
  });
});
