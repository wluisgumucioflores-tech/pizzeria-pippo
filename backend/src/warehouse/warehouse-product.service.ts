import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientStockException } from '../common/exceptions/insufficient-stock.exception';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { PurchaseWarehouseProductStockDto } from './dto/purchase-warehouse-product-stock.dto';
import type { AdjustWarehouseProductStockDto } from './dto/adjust-warehouse-product-stock.dto';
import type { TransferWarehouseProductStockDto } from './dto/transfer-warehouse-product-stock.dto';
import type { ListWarehouseProductMovementsQueryDto } from './dto/list-warehouse-product-movements-query.dto';
import type { WarehouseProductStockRow } from './types/warehouse-product-stock-row.types';
import type { WarehouseProductMovementRow } from './types/warehouse-product-movement.types';

@Injectable()
export class WarehouseProductService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: CurrentUserPayload): Promise<{ data: WarehouseProductStockRow[]; total: number }> {
    const rows = await this.prisma.warehouseProductStock.findMany({
      where: { businessId: this.resolveBusinessId(user) },
      orderBy: { variantId: 'asc' },
      include: { variant: { include: { product: true } } },
    });

    const filtered = rows
      .filter((row) => row.variant.product.isActive)
      .map((row): WarehouseProductStockRow => ({
        id: row.id,
        variant_id: row.variantId,
        quantity: row.quantity.toNumber(),
        min_quantity: row.minQuantity.toNumber(),
        product_variants: {
          id: row.variant.id,
          name: row.variant.name,
          products: { id: row.variant.product.id, name: row.variant.product.name },
        },
      }));

    return { data: filtered, total: filtered.length };
  }

  async getMovements(query: ListWarehouseProductMovementsQueryDto, user: CurrentUserPayload): Promise<WarehouseProductMovementRow[]> {
    const where = {
      businessId: this.resolveBusinessId(user),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };

    const rows = await this.prisma.warehouseProductMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { variant: { include: { product: true } }, branch: true },
    });

    return rows.map((row) => ({
      id: row.id,
      variant_id: row.variantId,
      branch_id: row.branchId,
      quantity: row.quantity.toNumber(),
      type: row.type,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      product_variants: {
        id: row.variant.id,
        name: row.variant.name,
        products: { id: row.variant.product.id, name: row.variant.product.name },
      },
      branches: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
    }));
  }

  async purchase(dto: PurchaseWarehouseProductStockDto, user: CurrentUserPayload): Promise<void> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }
    const businessId = this.resolveBusinessId(user);
    await this.assertVariantOwnership(dto.variant_id, businessId);

    const existing = await this.prisma.warehouseProductStock.findUnique({ where: { variantId: dto.variant_id } });

    if (existing) {
      await this.prisma.warehouseProductStock.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity.toNumber() + dto.quantity,
          updatedAt: new Date(),
          ...(dto.min_quantity != null ? { minQuantity: dto.min_quantity } : {}),
        },
      });
    } else {
      await this.prisma.warehouseProductStock.create({
        data: { businessId, variantId: dto.variant_id, quantity: dto.quantity, minQuantity: dto.min_quantity ?? 0 },
      });
    }

    await this.prisma.warehouseProductMovement.create({
      data: {
        businessId,
        variantId: dto.variant_id,
        quantity: dto.quantity,
        type: 'compra',
        branchId: null,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });
  }

  async adjust(dto: AdjustWarehouseProductStockDto, user: CurrentUserPayload): Promise<{ difference: number }> {
    if (dto.real_quantity < 0) {
      throw new BadRequestException('La cantidad no puede ser negativa');
    }
    const businessId = this.resolveBusinessId(user);
    await this.assertVariantOwnership(dto.variant_id, businessId);

    const existing = await this.prisma.warehouseProductStock.findUnique({ where: { variantId: dto.variant_id } });
    if (!existing) throw new NotFoundException('Producto no encontrado en bodega');

    const difference = dto.real_quantity - existing.quantity.toNumber();

    await this.prisma.warehouseProductStock.update({
      where: { id: existing.id },
      data: { quantity: dto.real_quantity, updatedAt: new Date() },
    });

    await this.prisma.warehouseProductMovement.create({
      data: {
        businessId,
        variantId: dto.variant_id,
        quantity: difference,
        type: 'ajuste',
        branchId: null,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });

    return { difference };
  }

  async transfer(dto: TransferWarehouseProductStockDto, user: CurrentUserPayload): Promise<void> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }
    const businessId = this.resolveBusinessId(user);
    await this.assertVariantOwnership(dto.variant_id, businessId);
    await this.assertBranchOwnership(dto.branch_id, businessId);

    const warehouseRow = await this.prisma.warehouseProductStock.findUnique({ where: { variantId: dto.variant_id } });
    if (!warehouseRow) throw new NotFoundException('Producto no encontrado en bodega');

    const available = warehouseRow.quantity.toNumber();
    if (available < dto.quantity) {
      throw new InsufficientStockException(`Stock insuficiente en bodega. Disponible: ${available}`, available);
    }

    await this.prisma.warehouseProductStock.update({
      where: { id: warehouseRow.id },
      data: { quantity: available - dto.quantity, updatedAt: new Date() },
    });

    const branchRow = await this.prisma.branchProductStock.findUnique({
      where: { branchId_variantId: { branchId: dto.branch_id, variantId: dto.variant_id } },
    });

    if (branchRow) {
      await this.prisma.branchProductStock.update({
        where: { id: branchRow.id },
        data: { quantity: branchRow.quantity.toNumber() + dto.quantity, updatedAt: new Date() },
      });
    } else {
      await this.prisma.branchProductStock.create({
        data: { branchId: dto.branch_id, variantId: dto.variant_id, quantity: dto.quantity, minQuantity: 0 },
      });
    }

    await this.prisma.warehouseProductMovement.create({
      data: {
        businessId,
        variantId: dto.variant_id,
        quantity: -dto.quantity,
        type: 'transferencia',
        branchId: dto.branch_id,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });

    await this.prisma.productStockMovement.create({
      data: {
        branchId: dto.branch_id,
        variantId: dto.variant_id,
        quantity: dto.quantity,
        type: 'compra',
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

  // Evita que un usuario del negocio B mueva stock de bodega de reventa
  // usando un variant_id/branch_id del negocio A, pasado directamente en el body.
  private async assertVariantOwnership(variantId: string, businessId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { businessId: true } });
    if (!variant || variant.businessId !== businessId) {
      throw new NotFoundException('Variante no encontrada');
    }
  }

  private async assertBranchOwnership(branchId: string, businessId: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
    if (!branch || branch.businessId !== businessId) {
      throw new NotFoundException('Sucursal no encontrada');
    }
  }
}
