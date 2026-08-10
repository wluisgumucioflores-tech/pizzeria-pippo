import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import type { BusinessResult } from './types/business-result.types';
import type { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async list(): Promise<BusinessResult[]> {
    const rows = await this.prisma.business.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toResult(row));
  }

  // Crea el negocio y su primer admin en una sola operación (Prisma envuelve
  // el nested create en una transacción implícita) — sin esto, un negocio
  // recién creado no tendría con quién loguearse. El admin no recibe
  // branchId: crea su primera sucursal él mismo una vez logueado.
  async create(dto: CreateBusinessDto): Promise<BusinessResult> {
    const passwordHash = await this.passwordHasher.hash(dto.admin.password);

    try {
      const business = await this.prisma.business.create({
        data: {
          name: dto.name,
          profiles: {
            create: {
              email: dto.admin.email,
              passwordHash,
              fullName: dto.admin.full_name,
              role: 'admin',
            },
          },
        },
      });
      return this.toResult(business);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw error;
    }
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.prisma.business.update({ where: { id }, data: { isActive } });
  }

  private toResult(row: { id: string; name: string; isActive: boolean; createdAt: Date }): BusinessResult {
    return {
      id: row.id,
      name: row.name,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
    };
  }
}
