import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import { CategoriesService } from '../categories/categories.service';
import type { BusinessResult } from './types/business-result.types';
import type { CreateBusinessDto } from './dto/create-business.dto';
import type { UpdateBusinessDto } from './dto/update-business.dto';
import { BUSINESS_MODULE_KEYS, DEFAULT_ENABLED_MODULES, type EnabledModules } from '@pippo/shared';

function pickValidModules(input: Partial<Record<string, unknown>> | undefined): Partial<EnabledModules> {
  if (!input) return {};
  const result: Partial<EnabledModules> = {};
  for (const key of BUSINESS_MODULE_KEYS) {
    if (typeof input[key] === 'boolean') {
      result[key] = input[key] as boolean;
    }
  }
  return result;
}

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly categoriesService: CategoriesService,
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
    const enabledModules = { ...DEFAULT_ENABLED_MODULES, ...pickValidModules(dto.enabled_modules) };

    try {
      const business = await this.prisma.business.create({
        data: {
          name: dto.name,
          enabledModules,
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
      // Categorías reales para todo negocio nuevo, sin condición de flag —
      // ya no existe un camino hardcodeado al que caer si esto falla.
      await this.categoriesService.seedDefaults(business.id);
      return this.toResult(business);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw error;
    }
  }

  // Update parcial: is_active se pisa directo, enabled_modules se mergea con
  // lo que ya tenía el negocio (dto.enabled_modules puede venir con solo
  // algunas keys, ej. al tildar/destildar un único checkbox en el modal).
  async update(id: string, dto: UpdateBusinessDto): Promise<BusinessResult> {
    const data: Prisma.BusinessUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.is_active !== undefined) data.isActive = dto.is_active;

    if (dto.enabled_modules !== undefined) {
      const current = await this.prisma.business.findUniqueOrThrow({ where: { id }, select: { enabledModules: true } });
      const currentModules = { ...DEFAULT_ENABLED_MODULES, ...(current.enabledModules as Partial<EnabledModules>) };
      data.enabledModules = { ...currentModules, ...pickValidModules(dto.enabled_modules) };
    }

    const business = await this.prisma.business.update({ where: { id }, data });
    return this.toResult(business);
  }

  private toResult(row: { id: string; name: string; isActive: boolean; createdAt: Date; enabledModules: Prisma.JsonValue }): BusinessResult {
    return {
      id: row.id,
      name: row.name,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
      enabled_modules: { ...DEFAULT_ENABLED_MODULES, ...(row.enabledModules as Partial<EnabledModules>) },
    };
  }
}
