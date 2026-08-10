import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VariantTypeInUseException } from '../common/exceptions/variant-type-in-use.exception';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { VariantType } from '@pippo/shared';
import type { ListVariantTypesQueryDto } from './dto/list-variant-types-query.dto';
import type { CreateVariantTypeDto } from './dto/create-variant-type.dto';
import type { UpdateVariantTypeDto } from './dto/update-variant-type.dto';

@Injectable()
export class VariantTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListVariantTypesQueryDto, user: CurrentUserPayload): Promise<VariantType[]> {
    const onlyActive = query.onlyActive !== 'false';
    const businessId = this.resolveBusinessId(user);

    const rows = await this.prisma.variantType.findMany({
      where: { businessId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.mapVariantType(row));
  }

  async create(dto: CreateVariantTypeDto, user: CurrentUserPayload): Promise<VariantType> {
    const row = await this.prisma.variantType.create({
      data: { businessId: this.resolveBusinessId(user), name: dto.name.trim() },
    });
    return this.mapVariantType(row);
  }

  async update(id: string, dto: UpdateVariantTypeDto, user: CurrentUserPayload): Promise<VariantType> {
    await this.assertOwnership(id, user);
    const row = await this.prisma.variantType.update({
      where: { id },
      data: { name: dto.name.trim() },
    });
    return this.mapVariantType(row);
  }

  async setActive(id: string, isActive: boolean, user: CurrentUserPayload): Promise<VariantType> {
    await this.assertOwnership(id, user);
    if (!isActive) {
      await this.assertNotInUse(id, user);
    }
    const row = await this.prisma.variantType.update({ where: { id }, data: { isActive } });
    return this.mapVariantType(row);
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  // Evita que un admin del negocio B opere sobre un tipo de variante del
  // negocio A conociendo su UUID — 404 en vez de 403 para no revelar que el id existe.
  private async assertOwnership(id: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const variantType = await this.prisma.variantType.findUnique({ where: { id }, select: { businessId: true } });
    if (!variantType || variantType.businessId !== businessId) {
      throw new NotFoundException('Tipo de variante no encontrado');
    }
  }

  private async assertNotInUse(id: string, user: CurrentUserPayload): Promise<void> {
    const variantType = await this.prisma.variantType.findUnique({ where: { id } });
    if (!variantType) {
      throw new NotFoundException('Tipo de variante no encontrado');
    }

    const count = await this.prisma.productVariant.count({
      where: { businessId: this.resolveBusinessId(user), name: variantType.name, isActive: true },
    });

    if (count > 0) {
      throw new VariantTypeInUseException(
        `Hay ${count} producto(s) usando este tipo. Desactivá las variantes primero.`,
        count,
      );
    }
  }

  private mapVariantType(row: {
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date | null;
  }): VariantType {
    return {
      id: row.id,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      created_at: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
