import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchHasCashiersException } from '../common/exceptions/branch-has-cashiers.exception';
import { BranchHasDependenciesException } from '../common/exceptions/branch-has-dependencies.exception';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: {
    branch: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    profile: { findMany: jest.Mock; findFirst: jest.Mock };
    order: { findFirst: jest.Mock };
    branchPrice: { findFirst: jest.Mock };
    branchStock: { findFirst: jest.Mock };
    stockMovement: { findFirst: jest.Mock };
    branchProductStock: { findFirst: jest.Mock };
    productStockMovement: { findFirst: jest.Mock };
    promotion: { findFirst: jest.Mock };
    device: { findFirst: jest.Mock };
  };

  const admin: CurrentUserPayload = { id: 'u1', email: 'admin@pippo.local', role: 'admin', branch_id: null, full_name: 'Admin', business_id: 'biz1' };
  const cajero: CurrentUserPayload = { id: 'u2', email: 'cajero@pippo.local', role: 'cajero', branch_id: 'b1', full_name: 'Cajero', business_id: 'biz1' };

  beforeEach(async () => {
    prisma = {
      branch: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      profile: { findMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      order: { findFirst: jest.fn().mockResolvedValue(null) },
      branchPrice: { findFirst: jest.fn().mockResolvedValue(null) },
      branchStock: { findFirst: jest.fn().mockResolvedValue(null) },
      stockMovement: { findFirst: jest.fn().mockResolvedValue(null) },
      branchProductStock: { findFirst: jest.fn().mockResolvedValue(null) },
      productStockMovement: { findFirst: jest.fn().mockResolvedValue(null) },
      promotion: { findFirst: jest.fn().mockResolvedValue(null) },
      device: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BranchesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BranchesService);
  });

  describe('list', () => {
    it('un admin ve todas las sucursales de su negocio (sin filtro por id)', async () => {
      prisma.branch.findMany.mockResolvedValue([]);

      await service.list({}, admin);

      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', isActive: true } }),
      );
    });

    it('un no-admin solo ve su propia sucursal', async () => {
      prisma.branch.findMany.mockResolvedValue([]);

      await service.list({}, cajero);

      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', isActive: true, id: 'b1' } }),
      );
    });

    it('incluye inactivas cuando showInactive=true', async () => {
      prisma.branch.findMany.mockResolvedValue([]);

      await service.list({ showInactive: 'true' }, admin);

      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });
  });

  describe('setActive / remove', () => {
    it('bloquea la desactivación si hay cajeros asignados', async () => {
      prisma.profile.findMany.mockResolvedValue([{ id: 'c1', fullName: 'Juan' }]);

      await expect(service.setActive('b1', false, admin)).rejects.toThrow(BranchHasCashiersException);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });

    it('permite la desactivación si no hay cajeros asignados', async () => {
      prisma.profile.findMany.mockResolvedValue([]);

      await service.setActive('b1', false, admin);

      expect(prisma.branch.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { isActive: false } });
    });

    it('rechaza con 404 si la sucursal pertenece a otro negocio', async () => {
      prisma.branch.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.setActive('b1', false, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });
  });

  describe('remove (hard delete)', () => {
    it('borra la sucursal si no tiene ningún dato asociado', async () => {
      await service.remove('b1', admin);

      expect(prisma.branch.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    });

    it('bloquea el borrado si tiene órdenes asociadas', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'o1' });

      await expect(service.remove('b1', admin)).rejects.toThrow(BranchHasDependenciesException);
      expect(prisma.branch.delete).not.toHaveBeenCalled();
    });

    it('bloquea el borrado si tiene usuarios asignados (cualquier rol, no solo cajero)', async () => {
      prisma.profile.findFirst.mockResolvedValue({ id: 'p1' });

      await expect(service.remove('b1', admin)).rejects.toThrow(BranchHasDependenciesException);
      expect(prisma.branch.delete).not.toHaveBeenCalled();
    });

    it('no expone conteos ni categorías en el error, solo un mensaje genérico', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'o1' });

      try {
        await service.remove('b1', admin);
        fail('esperaba que remove() lanzara una excepción');
      } catch (err) {
        expect(err).toBeInstanceOf(BranchHasDependenciesException);
        const response = (err as BranchHasDependenciesException).getResponse() as Record<string, unknown>;
        expect(response).not.toHaveProperty('dependencies');
        expect(typeof response.message).toBe('string');
      }
    });

    it('rechaza con 404 si la sucursal pertenece a otro negocio', async () => {
      prisma.branch.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.remove('b1', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.branch.delete).not.toHaveBeenCalled();
    });
  });
});
