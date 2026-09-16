import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { UpsertAnnouncementDto } from './dto/upsert-announcement.dto';
import type { AnnouncementResult } from './types/announcement-result.types';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AnnouncementResult[]> {
    const rows = await this.prisma.businessAnnouncement.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { business: { select: { name: true } } },
    });
    return rows.map((row) => this.toResult(row));
  }

  // One row per business (businessId UNIQUE) — upsert instead of a plain
  // create/update pair, since "editing" and "creating for the first time"
  // are the same action from the superadmin's perspective (see roadmap doc).
  async upsert(businessId: string, dto: UpsertAnnouncementDto, user: CurrentUserPayload): Promise<AnnouncementResult> {
    await this.assertBusinessExists(businessId);

    const row = await this.prisma.businessAnnouncement.upsert({
      where: { businessId },
      create: { businessId, message: dto.message, isActive: dto.is_active ?? true, updatedBy: user.id },
      update: { message: dto.message, isActive: dto.is_active ?? true, updatedBy: user.id },
      include: { business: { select: { name: true } } },
    });
    return this.toResult(row);
  }

  async remove(businessId: string): Promise<void> {
    const existing = await this.prisma.businessAnnouncement.findUnique({ where: { businessId } });
    if (!existing) {
      throw new NotFoundException('Este negocio no tiene un banner configurado');
    }
    await this.prisma.businessAnnouncement.delete({ where: { businessId } });
  }

  private async assertBusinessExists(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }
  }

  private toResult(row: {
    businessId: string;
    message: string;
    isActive: boolean;
    updatedAt: Date;
    business: { name: string };
  }): AnnouncementResult {
    return {
      business_id: row.businessId,
      business_name: row.business.name,
      message: row.message,
      is_active: row.isActive,
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
