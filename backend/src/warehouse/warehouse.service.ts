import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientStockException } from '../common/exceptions/insufficient-stock.exception';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { ListWarehouseStockQueryDto } from './dto/list-warehouse-stock-query.dto';
import type { ListWarehouseMovementsQueryDto } from './dto/list-warehouse-movements-query.dto';
import type { PurchaseWarehouseStockDto } from './dto/purchase-warehouse-stock.dto';
import type { AdjustWarehouseStockDto } from './dto/adjust-warehouse-stock.dto';
import type { TransferWarehouseStockDto } from './dto/transfer-warehouse-stock.dto';
import type { UpdateWarehouseMinQuantityDto } from './dto/update-warehouse-min-quantity.dto';
import type { WarehouseStockListResult, WarehouseStockRow } from './types/warehouse-stock-row.types';
import type { WarehouseMovementRow } from './types/warehouse-movement.types';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWarehouseStockQueryDto, user: CurrentUserPayload): Promise<WarehouseStockListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const businessId = this.resolveBusinessId(user);
    const where = {
      businessId,
      ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      ingredient: { isActive: true },
    };

    const [rows, total] = await Promise.all([
      this.prisma.warehouseStock.findMany({
        where,
        orderBy: { ingredient: { name: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { ingredient: true },
      }),
      this.prisma.warehouseStock.count({ where }),
    ]);

    const ingredientIds = rows.map((r) => r.ingredientId);
    const withMovements = new Set(
      ingredientIds.length
        ? (
            await this.prisma.warehouseMovement.findMany({
              where: { businessId, ingredientId: { in: ingredientIds } },
              select: { ingredientId: true },
              distinct: ['ingredientId'],
            })
          ).map((m) => m.ingredientId)
        : [],
    );

    let data: WarehouseStockRow[] = rows.map((row) => ({
      id: row.id,
      ingredient_id: row.ingredientId,
      quantity: row.quantity.toNumber(),
      min_quantity: row.minQuantity.toNumber(),
      updated_at: row.updatedAt.toISOString(),
      has_movements: withMovements.has(row.ingredientId),
      ingredients: { name: row.ingredient.name, unit: row.ingredient.unit },
    }));

    if (query.status === 'low') data = data.filter((r) => r.quantity < r.min_quantity);
    if (query.status === 'ok') data = data.filter((r) => r.quantity >= r.min_quantity);

    return { data, total, page, pageSize };
  }

  async getMovements(query: ListWarehouseMovementsQueryDto, user: CurrentUserPayload): Promise<WarehouseMovementRow[]> {
    const where = {
      businessId: this.resolveBusinessId(user),
      ...(query.type ? { type: query.type } : {}),
      ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };

    const rows = await this.prisma.warehouseMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { ingredient: true, branch: true },
    });

    return rows.map((row) => ({
      id: row.id,
      ingredient_id: row.ingredientId,
      quantity: row.quantity.toNumber(),
      type: row.type,
      branch_id: row.branchId,
      notes: row.notes,
      created_by: row.createdBy,
      created_at: row.createdAt.toISOString(),
      ingredients: { name: row.ingredient.name, unit: row.ingredient.unit },
      branches: row.branch ? { name: row.branch.name } : null,
    }));
  }

  async updateMinQuantity(id: string, dto: UpdateWarehouseMinQuantityDto, user: CurrentUserPayload): Promise<void> {
    const row = await this.prisma.warehouseStock.findUnique({ where: { id } });
    if (!row || row.businessId !== this.resolveBusinessId(user)) {
      throw new NotFoundException('Insumo no encontrado');
    }

    await this.prisma.warehouseStock.update({
      where: { id },
      data: { minQuantity: dto.min_quantity },
    });
  }

  async remove(id: string, user: CurrentUserPayload): Promise<void> {
    const row = await this.prisma.warehouseStock.findUnique({ where: { id } });
    if (!row || row.businessId !== this.resolveBusinessId(user)) {
      throw new NotFoundException('Insumo no encontrado');
    }

    const movementsCount = await this.prisma.warehouseMovement.count({ where: { ingredientId: row.ingredientId } });
    if (movementsCount > 0) {
      throw new ConflictException('No se puede eliminar: tiene movimientos registrados');
    }

    await this.prisma.warehouseStock.delete({ where: { id } });
  }

  async purchase(dto: PurchaseWarehouseStockDto, user: CurrentUserPayload): Promise<void> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }
    const businessId = this.resolveBusinessId(user);
    await this.assertIngredientOwnership(dto.ingredient_id, businessId);

    const existing = await this.prisma.warehouseStock.findUnique({ where: { ingredientId: dto.ingredient_id } });

    if (existing) {
      await this.prisma.warehouseStock.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity.toNumber() + dto.quantity,
          updatedAt: new Date(),
          ...(dto.min_quantity != null ? { minQuantity: dto.min_quantity } : {}),
        },
      });
    } else {
      await this.prisma.warehouseStock.create({
        data: { businessId, ingredientId: dto.ingredient_id, quantity: dto.quantity, minQuantity: dto.min_quantity ?? 0 },
      });
    }

    await this.prisma.warehouseMovement.create({
      data: {
        businessId,
        ingredientId: dto.ingredient_id,
        quantity: dto.quantity,
        type: 'compra',
        branchId: null,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });
  }

  async adjust(dto: AdjustWarehouseStockDto, user: CurrentUserPayload): Promise<{ difference: number }> {
    if (dto.real_quantity < 0) {
      throw new BadRequestException('La cantidad no puede ser negativa');
    }
    const businessId = this.resolveBusinessId(user);
    await this.assertIngredientOwnership(dto.ingredient_id, businessId);

    const existing = await this.prisma.warehouseStock.findUnique({ where: { ingredientId: dto.ingredient_id } });
    if (!existing) throw new NotFoundException('Insumo no encontrado en bodega');

    const difference = dto.real_quantity - existing.quantity.toNumber();

    await this.prisma.warehouseStock.update({
      where: { id: existing.id },
      data: { quantity: dto.real_quantity, updatedAt: new Date() },
    });

    await this.prisma.warehouseMovement.create({
      data: {
        businessId,
        ingredientId: dto.ingredient_id,
        quantity: difference,
        type: 'ajuste',
        branchId: null,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });

    return { difference };
  }

  async transfer(dto: TransferWarehouseStockDto, user: CurrentUserPayload): Promise<void> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }
    const businessId = this.resolveBusinessId(user);
    await this.assertIngredientOwnership(dto.ingredient_id, businessId);
    await this.assertBranchOwnership(dto.branch_id, businessId);

    const warehouseRow = await this.prisma.warehouseStock.findUnique({ where: { ingredientId: dto.ingredient_id } });
    if (!warehouseRow) throw new NotFoundException('Insumo no encontrado en bodega');

    const available = warehouseRow.quantity.toNumber();
    if (available < dto.quantity) {
      throw new InsufficientStockException(`Stock insuficiente en bodega. Disponible: ${available}`, available);
    }

    await this.prisma.warehouseStock.update({
      where: { id: warehouseRow.id },
      data: { quantity: available - dto.quantity, updatedAt: new Date() },
    });

    const branchRow = await this.prisma.branchStock.findFirst({
      where: { branchId: dto.branch_id, ingredientId: dto.ingredient_id },
    });

    if (branchRow) {
      await this.prisma.branchStock.update({
        where: { id: branchRow.id },
        data: { quantity: branchRow.quantity.toNumber() + dto.quantity, updatedAt: new Date() },
      });
    } else {
      await this.prisma.branchStock.create({
        data: { branchId: dto.branch_id, ingredientId: dto.ingredient_id, quantity: dto.quantity, minQuantity: 0 },
      });
    }

    await this.prisma.warehouseMovement.create({
      data: {
        businessId,
        ingredientId: dto.ingredient_id,
        quantity: -dto.quantity,
        type: 'transferencia',
        branchId: dto.branch_id,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });

    await this.prisma.stockMovement.create({
      data: {
        branchId: dto.branch_id,
        ingredientId: dto.ingredient_id,
        quantity: dto.quantity,
        type: 'compra',
        origin: 'transferencia',
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  // Evita que un admin del negocio B mueva stock de bodega usando un
  // ingredient_id/branch_id del negocio A, pasado directamente en el body.
  private async assertIngredientOwnership(ingredientId: string, businessId: string): Promise<void> {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { businessId: true } });
    if (!ingredient || ingredient.businessId !== businessId) {
      throw new NotFoundException('Insumo no encontrado');
    }
  }

  private async assertBranchOwnership(branchId: string, businessId: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
    if (!branch || branch.businessId !== businessId) {
      throw new NotFoundException('Sucursal no encontrada');
    }
  }
}
