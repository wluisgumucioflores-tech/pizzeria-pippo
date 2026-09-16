import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { LogIngredientUsageDto } from './dto/log-ingredient-usage.dto';
import type { LogOutputDto } from './dto/log-output.dto';
import type { ListProductionLogQueryDto } from './dto/list-production-log-query.dto';
import { dateRangeFrom, dateRangeTo } from '../common/utils/timezone';
import type { IngredientUsageLogRow, OutputLogRow, ProductionLogListResult } from './types/production-log.types';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async logIngredientUsage(dto: LogIngredientUsageDto, user: CurrentUserPayload): Promise<{ id: string }> {
    this.assertModuleEnabled(user);
    const businessId = this.resolveBusinessId(user);
    await this.assertIngredientOwnership(dto.ingredient_id, businessId);

    const row = await this.prisma.productionIngredientLog.create({
      data: {
        businessId,
        ingredientId: dto.ingredient_id,
        quantity: dto.quantity,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });
    return { id: row.id };
  }

  async logOutput(dto: LogOutputDto, user: CurrentUserPayload): Promise<{ id: string }> {
    this.assertModuleEnabled(user);
    const businessId = this.resolveBusinessId(user);
    await this.assertVariantOwnership(dto.variant_id, businessId);

    const row = await this.prisma.productionOutputLog.create({
      data: {
        businessId,
        variantId: dto.variant_id,
        quantity: dto.quantity,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });

    // Fase 10: with "Elaboración propia por unidad transferida" on, what's
    // produced becomes available in the business's warehouse pool — same
    // role a "purchase" plays for resale products — so the jefe de
    // producción can later transfer it to a branch (see WarehouseProductService.transfer).
    const flags = await this.settingsService.getStockControlFlags(user);
    if (flags.madeUnit) {
      await this.addToWarehouseStock(businessId, dto.variant_id, dto.quantity, user.id);
    }

    return { id: row.id };
  }

  async updateIngredientUsage(id: string, dto: LogIngredientUsageDto, user: CurrentUserPayload): Promise<void> {
    this.assertModuleEnabled(user);
    const businessId = this.resolveBusinessId(user);
    await this.assertIngredientUsageLogOwnership(id, businessId);
    await this.assertIngredientOwnership(dto.ingredient_id, businessId);

    await this.prisma.productionIngredientLog.update({
      where: { id },
      data: { ingredientId: dto.ingredient_id, quantity: dto.quantity, notes: dto.notes ?? null },
    });
  }

  async deleteIngredientUsage(id: string, user: CurrentUserPayload): Promise<void> {
    this.assertModuleEnabled(user);
    const businessId = this.resolveBusinessId(user);
    await this.assertIngredientUsageLogOwnership(id, businessId);
    await this.prisma.productionIngredientLog.delete({ where: { id } });
  }

  async updateOutput(id: string, dto: LogOutputDto, user: CurrentUserPayload): Promise<void> {
    this.assertModuleEnabled(user);
    const businessId = this.resolveBusinessId(user);
    const existingLog = await this.getOutputLogOrThrow(id, businessId);
    await this.assertVariantOwnership(dto.variant_id, businessId);

    const flags = await this.settingsService.getStockControlFlags(user);
    if (flags.madeUnit) {
      await this.adjustWarehouseStockForEdit(businessId, existingLog, dto, user.id);
    }

    await this.prisma.productionOutputLog.update({
      where: { id },
      data: { variantId: dto.variant_id, quantity: dto.quantity, notes: dto.notes ?? null },
    });
  }

  async deleteOutput(id: string, user: CurrentUserPayload): Promise<void> {
    this.assertModuleEnabled(user);
    const businessId = this.resolveBusinessId(user);
    const existingLog = await this.getOutputLogOrThrow(id, businessId);

    const flags = await this.settingsService.getStockControlFlags(user);
    if (flags.madeUnit) {
      await this.removeFromWarehouseStock(businessId, existingLog.variantId, existingLog.quantity, user.id);
    }

    await this.prisma.productionOutputLog.delete({ where: { id } });
  }

  async listIngredientUsage(
    query: ListProductionLogQueryDto,
    user: CurrentUserPayload,
  ): Promise<ProductionLogListResult<IngredientUsageLogRow>> {
    this.assertModuleEnabled(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      businessId: this.resolveBusinessId(user),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(dateRangeFrom(query.from)) } : {}),
              ...(query.to ? { lte: new Date(dateRangeTo(query.to)) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.productionIngredientLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { ingredient: true, creator: true },
      }),
      this.prisma.productionIngredientLog.count({ where }),
    ]);

    return {
      data: rows.map((row): IngredientUsageLogRow => ({
        id: row.id,
        ingredient_id: row.ingredientId,
        ingredient_name: row.ingredient.name,
        unit: row.ingredient.unit,
        quantity: row.quantity.toNumber(),
        notes: row.notes,
        created_by: row.createdBy,
        created_by_name: row.creator.fullName,
        created_at: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async listOutput(
    query: ListProductionLogQueryDto,
    user: CurrentUserPayload,
  ): Promise<ProductionLogListResult<OutputLogRow>> {
    this.assertModuleEnabled(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      businessId: this.resolveBusinessId(user),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(dateRangeFrom(query.from)) } : {}),
              ...(query.to ? { lte: new Date(dateRangeTo(query.to)) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.productionOutputLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { variant: { include: { product: true } }, creator: true },
      }),
      this.prisma.productionOutputLog.count({ where }),
    ]);

    return {
      data: rows.map((row): OutputLogRow => ({
        id: row.id,
        variant_id: row.variantId,
        product_name: row.variant.product.name,
        variant_name: row.variant.name,
        quantity: row.quantity.toNumber(),
        notes: row.notes,
        created_by: row.createdBy,
        created_by_name: row.creator.fullName,
        created_at: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // Defense in depth: the produccion role stays in the DB even if the
  // business loses the module after the user was created — this check,
  // not just the role guard, is what cuts access off immediately.
  private assertModuleEnabled(user: CurrentUserPayload): void {
    if (!user.enabled_modules.produccion) {
      throw new ForbiddenException('Tu negocio no tiene habilitado el módulo de producción.');
    }
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  private async assertIngredientOwnership(ingredientId: string, businessId: string): Promise<void> {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { businessId: true },
    });
    if (!ingredient || ingredient.businessId !== businessId) {
      throw new NotFoundException('Insumo no encontrado');
    }
  }

  private async assertVariantOwnership(variantId: string, businessId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { businessId: true },
    });
    if (!variant || variant.businessId !== businessId) {
      throw new NotFoundException('Producto no encontrado');
    }
  }

  // Same as assertIngredientOwnership/assertVariantOwnership but over the
  // log record itself (not the referenced ingredient/product) — prevents
  // someone from editing/deleting another business's record by guessing the UUID.
  private async assertIngredientUsageLogOwnership(id: string, businessId: string): Promise<void> {
    const log = await this.prisma.productionIngredientLog.findUnique({ where: { id }, select: { businessId: true } });
    if (!log || log.businessId !== businessId) {
      throw new NotFoundException('Registro no encontrado');
    }
  }

  // Same ownership check as assertOutputLogOwnership, but also returns the
  // log's current variant/quantity — needed by updateOutput/deleteOutput to
  // compute the warehouse stock delta (see adjustWarehouseStockForEdit/removeFromWarehouseStock).
  private async getOutputLogOrThrow(id: string, businessId: string): Promise<{ variantId: string; quantity: number }> {
    const log = await this.prisma.productionOutputLog.findUnique({
      where: { id },
      select: { businessId: true, variantId: true, quantity: true },
    });
    if (!log || log.businessId !== businessId) {
      throw new NotFoundException('Registro no encontrado');
    }
    return { variantId: log.variantId, quantity: log.quantity.toNumber() };
  }

  // Mirrors WarehouseProductService.purchase()'s upsert — what's produced
  // plays the same role a "purchase" plays for resale products: it makes
  // the unit available in the business's warehouse pool to transfer later.
  private async addToWarehouseStock(
    businessId: string,
    variantId: string,
    quantity: number,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.warehouseProductStock.findUnique({ where: { variantId } });
    if (existing) {
      await this.prisma.warehouseProductStock.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity.toNumber() + quantity, updatedAt: new Date() },
      });
    } else {
      await this.prisma.warehouseProductStock.create({
        data: { businessId, variantId, quantity, minQuantity: 0 },
      });
    }
    await this.prisma.warehouseProductMovement.create({
      data: {
        businessId,
        variantId,
        quantity,
        type: 'compra',
        branchId: null,
        notes: 'Producción registrada por el jefe de producción',
        createdBy: userId,
      },
    });
  }

  // Rejects if it would leave the warehouse balance negative — meaning more
  // of this batch was already transferred to a branch than would remain
  // after the correction, so editing/deleting is refused instead of
  // silently going negative.
  private async removeFromWarehouseStock(
    businessId: string,
    variantId: string,
    quantity: number,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.warehouseProductStock.findUnique({ where: { variantId } });
    const available = existing?.quantity.toNumber() ?? 0;
    if (available < quantity) {
      throw new BadRequestException(
        `No se puede editar/eliminar este registro: ya se transfirió más stock a sucursales del que quedaría disponible en bodega (disponible: ${available}).`,
      );
    }
    await this.prisma.warehouseProductStock.update({
      where: { id: existing!.id },
      data: { quantity: available - quantity, updatedAt: new Date() },
    });
    await this.prisma.warehouseProductMovement.create({
      data: {
        businessId,
        variantId,
        quantity: -quantity,
        type: 'ajuste',
        branchId: null,
        notes: 'Ajuste por edición/eliminación de un registro de producción',
        createdBy: userId,
      },
    });
  }

  // Editing a production log can change the quantity, the product, or both —
  // reconciles the warehouse pool for either case instead of assuming only
  // the quantity moved.
  private async adjustWarehouseStockForEdit(
    businessId: string,
    existingLog: { variantId: string; quantity: number },
    dto: LogOutputDto,
    userId: string,
  ): Promise<void> {
    if (existingLog.variantId === dto.variant_id) {
      const diff = dto.quantity - existingLog.quantity;
      if (diff > 0) {
        await this.addToWarehouseStock(businessId, dto.variant_id, diff, userId);
      } else if (diff < 0) {
        await this.removeFromWarehouseStock(businessId, dto.variant_id, -diff, userId);
      }
      return;
    }

    await this.removeFromWarehouseStock(businessId, existingLog.variantId, existingLog.quantity, userId);
    await this.addToWarehouseStock(businessId, dto.variant_id, dto.quantity, userId);
  }
}
