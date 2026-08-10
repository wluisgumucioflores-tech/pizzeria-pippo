import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { ListIngredientsQueryDto } from './dto/list-ingredients-query.dto';
import type { CreateIngredientDto } from './dto/create-ingredient.dto';
import type { UpdateIngredientDto } from './dto/update-ingredient.dto';
import type { IngredientListResult } from './types/ingredient-list-result.types';

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListIngredientsQueryDto, user: CurrentUserPayload): Promise<IngredientListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const showInactive = query.showInactive === 'true';

    const where = {
      businessId: this.resolveBusinessId(user),
      ...(showInactive ? {} : { isActive: true }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.ingredient.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ingredient.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        unit: row.unit as never,
        created_at: row.createdAt.toISOString(),
        is_active: row.isActive,
        is_shared_use: row.isSharedUse,
      })),
      total,
      page,
      pageSize,
    };
  }

  async create(dto: CreateIngredientDto, user: CurrentUserPayload) {
    const row = await this.prisma.ingredient.create({
      data: {
        businessId: this.resolveBusinessId(user),
        name: dto.name,
        unit: dto.unit,
        isSharedUse: dto.is_shared_use ?? false,
      },
    });
    return { id: row.id };
  }

  async update(id: string, dto: UpdateIngredientDto, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    if (dto.is_active === false) {
      await this.assertNotUsedInActiveRecipes(id);
    }
    await this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.is_active !== undefined && { isActive: dto.is_active }),
        ...(dto.is_shared_use !== undefined && { isSharedUse: dto.is_shared_use }),
      },
    });
  }

  async softDelete(id: string, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    await this.assertNotUsedInActiveRecipes(id);
    await this.prisma.ingredient.update({ where: { id }, data: { isActive: false } });
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  // Evita que un admin del negocio B opere sobre un insumo del negocio A
  // conociendo su UUID — 404 en vez de 403 para no revelar que el id existe.
  private async assertOwnership(id: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id }, select: { businessId: true } });
    if (!ingredient || ingredient.businessId !== businessId) {
      throw new NotFoundException('Insumo no encontrado');
    }
  }

  private async assertNotUsedInActiveRecipes(ingredientId: string): Promise<void> {
    const count = await this.prisma.recipe.count({
      where: { ingredientId, variant: { isActive: true } },
    });
    if (count > 0) {
      throw new ConflictException(
        `Este insumo está siendo usado en ${count} receta(s) activa(s). Desactiva los productos correspondientes antes de continuar.`,
      );
    }
  }
}
