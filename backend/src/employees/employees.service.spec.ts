import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: {
    employee: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let passwordHasher: { hash: jest.Mock; compare: jest.Mock };

  const admin: CurrentUserPayload = {
    id: 'u1',
    email: 'admin@pippo.local',
    role: 'admin',
    branch_id: null,
    full_name: 'Admin',
    business_id: 'biz1',
  };

  const employee = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'e1',
    businessId: 'biz1',
    branchId: 'b1',
    fullName: 'Juan Pérez',
    position: 'Delivery',
    credentialHash: 'hashed-token',
    manualCodeHash: 'hashed-code',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      employee: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    passwordHasher = {
      hash: jest.fn().mockImplementation(async (raw: string) => `hashed-${raw}`),
      compare: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordHasherService, useValue: passwordHasher },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  describe('create', () => {
    it('genera token y código crudos, hashea ambos y los devuelve solo esta vez', async () => {
      prisma.employee.create.mockResolvedValue(employee());

      const result = await service.create({ branch_id: 'b1', full_name: 'Juan Pérez', position: 'Delivery' }, admin);

      expect(result.credential.token.startsWith('pippo_emp_')).toBe(true);
      expect(result.credential.manual_code).toMatch(/^\d{6}$/);
      expect(result.credential.qr_image_data_url.startsWith('data:image/png;base64,')).toBe(true);
      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          branchId: 'b1',
          fullName: 'Juan Pérez',
          position: 'Delivery',
          credentialHash: `hashed-${result.credential.token}`,
          manualCodeHash: `hashed-${result.credential.manual_code}`,
        },
      });
      expect(result.employee).toEqual({
        id: 'e1',
        branch_id: 'b1',
        full_name: 'Juan Pérez',
        position: 'Delivery',
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  describe('regenerateCredential', () => {
    it('invalida la credencial vieja generando un nuevo token y código', async () => {
      prisma.employee.findUnique.mockResolvedValue(employee());
      prisma.employee.update.mockResolvedValue(employee({ credentialHash: 'new-hash' }));

      const result = await service.regenerateCredential('e1', admin);

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { credentialHash: expect.any(String), manualCodeHash: expect.any(String) },
      });
      expect(result.credential.token.startsWith('pippo_emp_')).toBe(true);
    });

    it('lanza NotFoundException si el empleado no existe', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.regenerateCredential('nope', admin)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el empleado pertenece a otro negocio', async () => {
      prisma.employee.findUnique.mockResolvedValue(employee({ businessId: 'otro-negocio' }));

      await expect(service.regenerateCredential('e1', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyCredential', () => {
    it('devuelve el empleado cuando el token coincide', async () => {
      prisma.employee.findMany.mockResolvedValue([employee({ id: 'e1' }), employee({ id: 'e2', credentialHash: 'other' })]);
      passwordHasher.compare.mockImplementation(async (_raw: string, hash: string) => hash === 'hashed-token');

      const result = await service.verifyCredential({ token: 'raw-token' });

      expect(result).toEqual({ id: 'e1', fullName: 'Juan Pérez', branchId: 'b1' });
    });

    it('devuelve el empleado cuando el código manual coincide', async () => {
      prisma.employee.findMany.mockResolvedValue([employee({ id: 'e1' })]);
      passwordHasher.compare.mockImplementation(async (_raw: string, hash: string) => hash === 'hashed-code');

      const result = await service.verifyCredential({ manualCode: '123456' });

      expect(result).toEqual({ id: 'e1', fullName: 'Juan Pérez', branchId: 'b1' });
    });

    it('devuelve null si ningún empleado activo coincide', async () => {
      prisma.employee.findMany.mockResolvedValue([employee()]);
      passwordHasher.compare.mockResolvedValue(false);

      const result = await service.verifyCredential({ token: 'wrong' });

      expect(result).toBeNull();
    });

    it('solo busca entre empleados activos', async () => {
      prisma.employee.findMany.mockResolvedValue([]);

      await service.verifyCredential({ token: 'any' });

      expect(prisma.employee.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });
});
