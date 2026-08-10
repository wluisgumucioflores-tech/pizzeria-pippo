import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    profile: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    order: { findMany: jest.Mock; count: jest.Mock };
  };
  let passwordHasher: { hash: jest.Mock };

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
      profile: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      order: { findMany: jest.fn(), count: jest.fn() },
    };
    passwordHasher = { hash: jest.fn().mockResolvedValue('hashed-password') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordHasherService, useValue: passwordHasher },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('list', () => {
    it('mapea los profiles con has_orders calculado', async () => {
      prisma.profile.findMany.mockResolvedValue([
        {
          id: 'u1',
          email: 'a@a.com',
          fullName: 'A',
          role: 'admin',
          branchId: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          isBanned: false,
        },
        {
          id: 'u2',
          email: 'b@b.com',
          fullName: null,
          role: 'cajero',
          branchId: 'b1',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          isBanned: true,
        },
      ]);
      prisma.order.findMany.mockResolvedValue([{ cashierId: 'u1' }]);

      const result = await service.list(admin);

      expect(result).toEqual([
        {
          id: 'u1',
          email: 'a@a.com',
          full_name: 'A',
          role: 'admin',
          branch_id: null,
          created_at: '2026-01-01T00:00:00.000Z',
          is_banned: false,
          has_orders: true,
        },
        {
          id: 'u2',
          email: 'b@b.com',
          full_name: '',
          role: 'cajero',
          branch_id: 'b1',
          created_at: '2026-01-02T00:00:00.000Z',
          is_banned: true,
          has_orders: false,
        },
      ]);
      expect(prisma.profile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz1' } }));
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branch: { businessId: 'biz1' } } }),
      );
    });
  });

  describe('create', () => {
    it('hashea la contraseña y crea el profile', async () => {
      prisma.profile.create.mockResolvedValue({ id: 'u1' });

      const result = await service.create(
        {
          email: 'a@a.com',
          password: 'secret1',
          full_name: 'A',
          role: 'cajero',
          branch_id: 'b1',
        },
        admin,
      );

      expect(passwordHasher.hash).toHaveBeenCalledWith('secret1');
      expect(prisma.profile.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          email: 'a@a.com',
          passwordHash: 'hashed-password',
          fullName: 'A',
          role: 'cajero',
          branchId: 'b1',
        },
      });
      expect(result).toEqual({ id: 'u1' });
    });

    it('lanza ConflictException si el email ya existe (P2002)', async () => {
      prisma.profile.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(
        service.create({ email: 'a@a.com', password: 'secret1', full_name: 'A', role: 'cajero' }, admin),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('actualiza datos básicos sin tocar la contraseña si no se envía', async () => {
      prisma.profile.findUnique.mockResolvedValue({ businessId: 'biz1' });

      await service.update('u1', { full_name: 'A', role: 'admin', branch_id: 'b1' }, admin);

      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { fullName: 'A', role: 'admin', branchId: 'b1' },
      });
      expect(passwordHasher.hash).not.toHaveBeenCalled();
    });

    it('hashea y actualiza la contraseña si se envía', async () => {
      prisma.profile.findUnique.mockResolvedValue({ businessId: 'biz1' });

      await service.update('u1', { full_name: 'A', role: 'admin', password: 'nueva-clave' }, admin);

      expect(passwordHasher.hash).toHaveBeenCalledWith('nueva-clave');
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { fullName: 'A', role: 'admin', branchId: null, passwordHash: 'hashed-password' },
      });
    });

    it('rechaza con 404 si el usuario pertenece a otro negocio', async () => {
      prisma.profile.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.update('u1', { full_name: 'A', role: 'admin' }, admin)).rejects.toThrow(NotFoundException);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });
  });

  describe('toggleBan', () => {
    it('actualiza is_banned directamente', async () => {
      prisma.profile.findUnique.mockResolvedValue({ businessId: 'biz1' });

      await service.toggleBan('u1', true, admin);

      expect(prisma.profile.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isBanned: true } });
    });
  });

  describe('remove', () => {
    it('bloquea el borrado si el usuario tiene ventas registradas', async () => {
      prisma.profile.findUnique.mockResolvedValue({ businessId: 'biz1' });
      prisma.order.count.mockResolvedValue(2);

      await expect(service.remove('u1', admin)).rejects.toThrow(ConflictException);
      expect(prisma.profile.delete).not.toHaveBeenCalled();
    });

    it('borra el profile si no tiene ventas', async () => {
      prisma.profile.findUnique.mockResolvedValue({ businessId: 'biz1' });
      prisma.order.count.mockResolvedValue(0);

      await service.remove('u1', admin);

      expect(prisma.profile.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('rechaza con 404 si el usuario pertenece a otro negocio', async () => {
      prisma.profile.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

      await expect(service.remove('u1', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.profile.delete).not.toHaveBeenCalled();
    });
  });
});
