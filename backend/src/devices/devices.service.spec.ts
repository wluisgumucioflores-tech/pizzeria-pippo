import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

describe('DevicesService', () => {
  let service: DevicesService;
  let prisma: { device: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let passwordHasher: { hash: jest.Mock; compare: jest.Mock };

  const admin: CurrentUserPayload = {
    id: 'u1',
    email: 'admin@pippo.local',
    role: 'admin',
    branch_id: null,
    full_name: 'Admin',
    business_id: 'biz1',
  };

  const device = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'd1',
    branchId: 'b1',
    name: 'Celular caja 1',
    apiKeyHash: 'hashed-key',
    isActive: true,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = { device: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() } };
    passwordHasher = { hash: jest.fn().mockResolvedValue('hashed-key'), compare: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordHasherService, useValue: passwordHasher },
      ],
    }).compile();

    service = module.get(DevicesService);
  });

  describe('create', () => {
    it('genera un API key crudo, hashea y lo devuelve solo esta vez', async () => {
      prisma.device.create.mockResolvedValue(device());

      const result = await service.create({ branch_id: 'b1', name: 'Celular caja 1' }, admin);

      expect(passwordHasher.hash).toHaveBeenCalledWith(result.apiKey);
      expect(result.apiKey.startsWith('pippo_dev_')).toBe(true);
      expect(prisma.device.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', branchId: 'b1', name: 'Celular caja 1', apiKeyHash: 'hashed-key' },
      });
      expect(result.device).toEqual({
        id: 'd1',
        branch_id: 'b1',
        name: 'Celular caja 1',
        is_active: true,
        last_seen_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  describe('verifyApiKey', () => {
    it('devuelve el dispositivo y actualiza lastSeenAt cuando el API key coincide', async () => {
      prisma.device.findMany.mockResolvedValue([device({ id: 'd1' }), device({ id: 'd2', apiKeyHash: 'other-hash' })]);
      passwordHasher.compare.mockImplementation(async (_raw: string, hash: string) => hash === 'hashed-key');

      const result = await service.verifyApiKey('raw-key');

      expect(result).toEqual({ id: 'd1', branchId: 'b1' });
      expect(prisma.device.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { lastSeenAt: expect.any(Date) } });
    });

    it('devuelve null si ningún dispositivo activo coincide', async () => {
      prisma.device.findMany.mockResolvedValue([device()]);
      passwordHasher.compare.mockResolvedValue(false);

      const result = await service.verifyApiKey('wrong-key');

      expect(result).toBeNull();
      expect(prisma.device.update).not.toHaveBeenCalled();
    });

    it('solo busca entre dispositivos activos', async () => {
      prisma.device.findMany.mockResolvedValue([]);

      await service.verifyApiKey('any-key');

      expect(prisma.device.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });
});
