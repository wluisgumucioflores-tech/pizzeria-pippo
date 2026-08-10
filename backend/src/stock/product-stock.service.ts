import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { ListProductStockQueryDto } from './dto/list-product-stock-query.dto';
import type { ListProductMovementsQueryDto } from './dto/list-product-movements-query.dto';
import type { PurchaseProductStockDto } from './dto/purchase-product-stock.dto';
import type { AdjustProductStockDto } from './dto/adjust-product-stock.dto';
import type { ProductStockRow, ResaleVariantRow } from './types/product-stock-row.types';
import type { ProductMovementListResult } from './types/product-movement.types';

@Injectable()
export class ProductStockService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductStockQueryDto, user: CurrentUserPayload): Promise<{ data: ProductStockRow[]; total: number }> {
    const rows = await this.prisma.branchProductStock.findMany({
      where: { branch: { businessId: this.resolveBusinessId(user) }, branchId: query.branchId },
      orderBy: { variantId: 'asc' },
      include: { variant: { include: { product: true } } },
    });

    const filtered = rows
      .filter((row) => row.variant.product.isActive)
      .map((row): ProductStockRow => ({
        id: row.id,
        variant_id: row.variantId,
        quantity: row.quantity.toNumber(),
        min_quantity: row.minQuantity.toNumber(),
        product_variants: {
          id: row.variant.id,
          name: row.variant.name,
          base_price: row.variant.basePrice.toNumber(),
          products: { id: row.variant.product.id, name: row.variant.product.name },
        },
      }));

    return { data: filtered, total: filtered.length };
  }

  async getResaleVariants(user: CurrentUserPayload): Promise<ResaleVariantRow[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        businessId: this.resolveBusinessId(user),
        isActive: true,
        product: { isActive: true, productType: 'resale' },
      },
      orderBy: { id: 'asc' },
      include: { product: true },
    });

    return variants.map((v) => ({
      id: v.id,
      name: v.name,
      products: { id: v.product.id, name: v.product.name },
    }));
  }

  async getMovements(query: ListProductMovementsQueryDto, user: CurrentUserPayload): Promise<ProductMovementListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = {
      branch: { businessId: this.resolveBusinessId(user) },
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.productStockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { variant: { include: { product: true } } },
      }),
      this.prisma.productStockMovement.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        quantity: row.quantity.toNumber(),
        type: row.type,
        notes: row.notes,
        created_at: row.createdAt.toISOString(),
        product_variants: {
          id: row.variant.id,
          name: row.variant.name,
          products: { id: row.variant.product.id, name: row.variant.product.name },
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  async purchase(dto: PurchaseProductStockDto, user: CurrentUserPayload): Promise<void> {
    await this.assertBranchOwnership(dto.branch_id, user);

    const existing = await this.prisma.branchProductStock.findUnique({
      where: { branchId_variantId: { branchId: dto.branch_id, variantId: dto.variant_id } },
    });

    if (existing) {
      await this.prisma.branchProductStock.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity.toNumber() + dto.quantity, updatedAt: new Date() },
      });
    } else {
      await this.prisma.branchProductStock.create({
        data: {
          branchId: dto.branch_id,
          variantId: dto.variant_id,
          quantity: dto.quantity,
          minQuantity: dto.min_quantity ?? 0,
        },
      });
    }

    await this.prisma.productStockMovement.create({
      data: {
        branchId: dto.branch_id,
        variantId: dto.variant_id,
        quantity: dto.quantity,
        type: 'compra',
        createdBy: user.id,
      },
    });
  }

  // Not every product arrives via a warehouse transfer — some get bought
  // directly at the branch, so there may be no branch_product_stock row yet.
  // Adjust upserts (same as purchase()) instead of requiring a prior transfer.
  async adjust(dto: AdjustProductStockDto, user: CurrentUserPayload): Promise<{ difference: number }> {
    await this.assertBranchOwnership(dto.branch_id, user);

    const existing = await this.prisma.branchProductStock.findUnique({
      where: { branchId_variantId: { branchId: dto.branch_id, variantId: dto.variant_id } },
    });

    const difference = dto.real_quantity - (existing?.quantity.toNumber() ?? 0);

    if (existing) {
      await this.prisma.branchProductStock.update({
        where: { id: existing.id },
        data: { quantity: dto.real_quantity, updatedAt: new Date() },
      });
    } else {
      await this.prisma.branchProductStock.create({
        data: {
          branchId: dto.branch_id,
          variantId: dto.variant_id,
          quantity: dto.real_quantity,
          minQuantity: 0,
        },
      });
    }

    await this.prisma.productStockMovement.create({
      data: {
        branchId: dto.branch_id,
        variantId: dto.variant_id,
        quantity: difference,
        type: 'ajuste',
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
    });

    return { difference };
  }

  async updateMinQuantity(id: string, minQuantity: number, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const row = await this.prisma.branchProductStock.findUnique({
      where: { id },
      select: { branch: { select: { businessId: true } } },
    });
    if (!row || row.branch.businessId !== businessId) {
      throw new NotFoundException('Registro de stock no encontrado');
    }
    await this.prisma.branchProductStock.update({ where: { id }, data: { minQuantity } });
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  // Evita que un usuario del negocio B escriba stock de reventa en una
  // sucursal del negocio A pasando su branch_id directamente en el body.
  private async assertBranchOwnership(branchId: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
    if (!branch || branch.businessId !== businessId) {
      throw new NotFoundException('Sucursal no encontrada');
    }
  }
}
