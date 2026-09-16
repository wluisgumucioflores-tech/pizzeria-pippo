import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { DEFAULT_ENABLED_MODULES } from '@pippo/shared';

const superadmin: CurrentUserPayload = {
  id: 'sa1',
  email: 'super@pippo.local',
  role: 'superadmin',
  branch_id: null,
  full_name: 'Super Admin',
  business_id: null,
  enabled_modules: DEFAULT_ENABLED_MODULES,
};

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: {
    businessAnnouncement: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock; delete: jest.Mock };
    business: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      businessAnnouncement: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
      business: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnnouncementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AnnouncementsService);
  });

  describe('list', () => {
    it('maps rows with the joined business name', async () => {
      prisma.businessAnnouncement.findMany.mockResolvedValue([
        {
          businessId: 'b1',
          message: 'Mantenimiento programado',
          isActive: true,
          updatedAt: new Date('2026-09-01T00:00:00.000Z'),
          business: { name: 'Pizzeria Centro' },
        },
      ]);

      const result = await service.list();

      expect(result).toEqual([
        {
          business_id: 'b1',
          business_name: 'Pizzeria Centro',
          message: 'Mantenimiento programado',
          is_active: true,
          updated_at: '2026-09-01T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('upsert', () => {
    it('rejects when the business does not exist', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.upsert('missing', { message: 'hola' }, superadmin)).rejects.toThrow(NotFoundException);
      expect(prisma.businessAnnouncement.upsert).not.toHaveBeenCalled();
    });

    it('creates or updates the single row for that business, defaulting is_active to true', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.businessAnnouncement.upsert.mockResolvedValue({
        businessId: 'b1',
        message: 'Cerrado por feriado',
        isActive: true,
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        business: { name: 'Pizzeria Centro' },
      });

      const result = await service.upsert('b1', { message: 'Cerrado por feriado' }, superadmin);

      expect(prisma.businessAnnouncement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'b1' },
          create: expect.objectContaining({ businessId: 'b1', message: 'Cerrado por feriado', isActive: true, updatedBy: 'sa1' }),
          update: expect.objectContaining({ message: 'Cerrado por feriado', isActive: true, updatedBy: 'sa1' }),
        }),
      );
      expect(result.business_name).toBe('Pizzeria Centro');
    });
  });

  describe('remove', () => {
    it('rejects when the business has no announcement', async () => {
      prisma.businessAnnouncement.findUnique.mockResolvedValue(null);

      await expect(service.remove('b1')).rejects.toThrow(NotFoundException);
      expect(prisma.businessAnnouncement.delete).not.toHaveBeenCalled();
    });

    it('deletes the row when it exists', async () => {
      prisma.businessAnnouncement.findUnique.mockResolvedValue({ businessId: 'b1' });

      await service.remove('b1');

      expect(prisma.businessAnnouncement.delete).toHaveBeenCalledWith({ where: { businessId: 'b1' } });
    });
  });
});
