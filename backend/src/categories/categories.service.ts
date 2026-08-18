import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryHasProductsException } from '../common/exceptions/category-has-products.exception';
import type { Category } from '@pippo/shared';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

const DEFAULT_CATEGORIES = [
  { name: 'Pizza', isPizza: true, sortOrder: 0 },
  { name: 'Bebida', isPizza: false, sortOrder: 1 },
  { name: 'Otro', isPizza: false, sortOrder: 2 },
];

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: CurrentUserPayload): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { businessId: this.resolveBusinessId(user), isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => this.mapCategory(row));
  }

  async create(dto: CreateCategoryDto, user: CurrentUserPayload): Promise<Category> {
    const businessId = this.resolveBusinessId(user);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.is_pizza) {
        await tx.category.updateMany({ where: { businessId, isPizza: true }, data: { isPizza: false } });
      }
      return tx.category.create({
        data: { businessId, name: dto.name, isPizza: dto.is_pizza ?? false, sortOrder: dto.sort_order ?? 0 },
      });
    });
    return this.mapCategory(row);
  }

  async update(id: string, dto: UpdateCategoryDto, user: CurrentUserPayload): Promise<Category> {
    const businessId = this.resolveBusinessId(user);
    await this.assertOwnership(id, businessId);

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.is_pizza) {
        await tx.category.updateMany({ where: { businessId, isPizza: true, id: { not: id } }, data: { isPizza: false } });
      }
      return tx.category.update({
        where: { id },
        data: { name: dto.name, isPizza: dto.is_pizza, sortOrder: dto.sort_order },
      });
    });
    return this.mapCategory(row);
  }

  async remove(id: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    await this.assertOwnership(id, businessId);
    await this.assertNoProducts(id);
    await this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }

  // Llamado desde BusinessesService cuando enabled_modules.categories pasa a
  // true — crea las 3 categorías default solo si el negocio no tiene ninguna
  // todavía (evita duplicar si se apaga y prende el módulo varias veces).
  async seedDefaults(businessId: string): Promise<void> {
    const existing = await this.prisma.category.findFirst({ where: { businessId } });
    if (existing) return;

    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ businessId, ...c })),
    });
  }

  private async assertOwnership(id: string, businessId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { businessId: true } });
    if (!category || category.businessId !== businessId) {
      throw new NotFoundException('Categoría no encontrada');
    }
  }

  private async assertNoProducts(categoryId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { categoryId }, select: { id: true } });
    if (product) {
      throw new CategoryHasProductsException(
        'No se puede eliminar la categoría: hay productos asignados a ella. Reasignalos antes de continuar.',
      );
    }
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  private mapCategory(row: {
    id: string;
    businessId: string;
    name: string;
    isPizza: boolean;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
  }): Category {
    return {
      id: row.id,
      business_id: row.businessId,
      name: row.name,
      is_pizza: row.isPizza,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
    };
  }
}
