import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductHasSalesException } from '../common/exceptions/product-has-sales.exception';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { Product, ProductVariant } from '@pippo/shared';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ProductListResult } from './types/product-list-result.types';
import type { ProductDetailResult } from './types/product-detail.types';
import type { PosCatalogProduct, PosCatalogVariant } from './types/pos-catalog-result.types';
import type { VariantOption } from './types/variant-option.types';
import type { BranchPricesResult } from './types/branch-prices-result.types';
import type { UpsertBranchPriceDto } from './dto/upsert-branch-price.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductsQueryDto, user: CurrentUserPayload): Promise<ProductListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const showInactive = query.showInactive === 'true';

    const where = {
      businessId: this.resolveBusinessId(user),
      ...(showInactive ? {} : { isActive: true }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(query.category ? { category: query.category } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { variants: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: rows.map((row) => this.mapProduct(row)), total, page, pageSize };
  }

  // Rich shape (with denormalized branch/ingredient names) — used by the product
  // detail view; the edit view only needs the basic subset, via `list()`/mapProduct().
  async getDetail(id: string, user: CurrentUserPayload): Promise<ProductDetailResult | null> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            branchPrices: { include: { branch: true } },
            recipes: { include: { ingredient: true } },
          },
        },
      },
    });
    if (!row || row.businessId !== this.resolveBusinessId(user)) return null;

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      image_url: row.imageUrl,
      product_type: row.productType,
      created_at: row.createdAt.toISOString(),
      is_active: row.isActive,
      product_variants: row.variants.map((v) => ({
        id: v.id,
        product_id: v.productId,
        name: v.name,
        base_price: v.basePrice.toNumber(),
        created_at: v.createdAt.toISOString(),
        is_active: v.isActive,
        branch_prices: v.branchPrices.map((bp) => ({
          branch_id: bp.branchId,
          variant_id: bp.variantId,
          price: bp.price.toNumber(),
          branches: { name: bp.branch.name },
        })),
        recipes: v.recipes.map((r) => ({
          ingredient_id: r.ingredientId,
          quantity: r.quantity.toNumber(),
          apply_condition: r.applyCondition,
          ingredients: { name: r.ingredient.name, unit: r.ingredient.unit },
        })),
      })),
    };
  }

  // POS catalog: only variants with a branch price for "made" products
  // (resale ones don't need a branch_price), + stock_quantity embedded
  // for resale variants. Exact replica of the old /api/products?branchId=
  // route (isPOS branch), which is different from the list() above.
  async getPosCatalog(branchId: string, user: CurrentUserPayload): Promise<PosCatalogProduct[]> {
    const rows = await this.prisma.product.findMany({
      where: { businessId: this.resolveBusinessId(user), isActive: true },
      orderBy: { name: 'asc' },
      include: {
        variants: { include: { branchPrices: true, recipes: true } },
      },
    });

    const mapped: PosCatalogProduct[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      image_url: row.imageUrl,
      is_active: row.isActive,
      product_type: row.productType,
      product_variants: row.variants.map((v) => ({
        id: v.id,
        name: v.name,
        base_price: v.basePrice.toNumber(),
        is_active: v.isActive,
        branch_prices: v.branchPrices.map((bp) => ({ branch_id: bp.branchId, price: bp.price.toNumber() })),
        recipes: v.recipes.map((r) => ({
          ingredient_id: r.ingredientId,
          quantity: r.quantity.toNumber(),
          apply_condition: r.applyCondition,
        })),
      })),
    }));

    const filtered = mapped
      .map((p) => {
        if (p.product_type === 'resale') return p;
        return {
          ...p,
          product_variants: p.product_variants.filter((v) =>
            v.branch_prices.some((bp) => bp.branch_id === branchId),
          ),
        };
      })
      .filter((p) => p.product_type === 'resale' || p.product_variants.length > 0);

    const resaleVariantIds = filtered.flatMap((p) =>
      p.product_type === 'resale' ? p.product_variants.map((v) => v.id) : [],
    );

    if (resaleVariantIds.length > 0) {
      const stockRows = await this.prisma.branchProductStock.findMany({
        where: { branchId, variantId: { in: resaleVariantIds } },
      });
      const stockMap = new Map(stockRows.map((r) => [r.variantId, r.quantity.toNumber()]));

      for (const product of filtered) {
        if (product.product_type !== 'resale') continue;
        for (const variant of product.product_variants as PosCatalogVariant[]) {
          variant.stock_quantity = stockMap.get(variant.id) ?? null;
        }
      }
    }

    return filtered;
  }

  // Flat list of variants across all products (name + product), used by the
  // promotions combo builder to pick which variant each rule applies to —
  // doesn't need prices or recipes, just id/name.
  async listAllVariants(user: CurrentUserPayload): Promise<VariantOption[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { businessId: this.resolveBusinessId(user) },
      orderBy: { name: 'asc' },
      include: { product: true },
    });

    return variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      product_name: variant.product?.name ?? '',
    }));
  }

  // Replica of the old /api/products/[id]/branch-prices route — the
  // per-branch price editing page in the admin.
  async getBranchPrices(productId: string, user: CurrentUserPayload): Promise<BranchPricesResult> {
    const businessId = this.resolveBusinessId(user);
    const [variants, branches] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { productId, businessId, isActive: true },
        orderBy: { name: 'asc' },
        include: { branchPrices: { include: { branch: true } } },
      }),
      this.prisma.branch.findMany({ where: { businessId, isActive: true }, orderBy: { name: 'asc' } }),
    ]);

    return {
      variants: variants.map((v) => ({
        id: v.id,
        name: v.name,
        base_price: v.basePrice.toNumber(),
        branch_prices: v.branchPrices.map((bp) => ({
          id: bp.id,
          branch_id: bp.branchId,
          price: bp.price.toNumber(),
          branches: { id: bp.branch.id, name: bp.branch.name },
        })),
      })),
      branches: branches.map((b) => ({ id: b.id, name: b.name })),
    };
  }

  async upsertBranchPrice(dto: UpsertBranchPriceDto, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const [variant, branch] = await Promise.all([
      this.prisma.productVariant.findUnique({ where: { id: dto.variant_id }, select: { businessId: true } }),
      this.prisma.branch.findUnique({ where: { id: dto.branch_id }, select: { businessId: true } }),
    ]);
    if (!variant || variant.businessId !== businessId || !branch || branch.businessId !== businessId) {
      throw new NotFoundException('Variante o sucursal no encontrada');
    }

    const existing = await this.prisma.branchPrice.findFirst({
      where: { variantId: dto.variant_id, branchId: dto.branch_id },
    });

    if (existing) {
      await this.prisma.branchPrice.update({ where: { id: existing.id }, data: { price: dto.price } });
    } else {
      await this.prisma.branchPrice.create({
        data: { variantId: dto.variant_id, branchId: dto.branch_id, price: dto.price },
      });
    }
  }

  async getVariantsWithDetails(productId: string, user: CurrentUserPayload): Promise<ProductVariant[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId, businessId: this.resolveBusinessId(user) },
      include: { branchPrices: true, recipes: { include: { ingredient: true } } },
    });

    return variants.map((v) => ({
      id: v.id,
      product_id: v.productId,
      name: v.name,
      base_price: v.basePrice.toNumber(),
      created_at: v.createdAt.toISOString(),
      is_active: v.isActive,
      branch_prices: v.branchPrices.map((bp) => ({
        branch_id: bp.branchId,
        variant_id: bp.variantId,
        price: bp.price.toNumber(),
      })),
      recipes: v.recipes.map((r) => ({
        ingredient_id: r.ingredientId,
        quantity: r.quantity.toNumber(),
        apply_condition: r.applyCondition as never,
        ingredients: { name: r.ingredient.name, unit: r.ingredient.unit },
      })),
    }));
  }

  async create(dto: CreateProductDto, user: CurrentUserPayload): Promise<{ id: string }> {
    const businessId = this.resolveBusinessId(user);
    const productType = dto.product_type ?? 'made';
    const product = await this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        imageUrl: dto.image_url,
        productType,
      },
    });

    for (const variant of dto.variants) {
      const createdVariant = await this.prisma.productVariant.create({
        data: { businessId, productId: product.id, name: variant.name, basePrice: variant.base_price },
      });
      await this.replaceVariantExtras(createdVariant.id, variant, productType);
    }

    return { id: product.id };
  }

  // Copia el producto completo (variantes, recetas, precios por sucursal)
  // como borrador inactivo, para que el admin lo revise y active a mano.
  async duplicate(id: string, user: CurrentUserPayload): Promise<{ id: string }> {
    const original = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { include: { branchPrices: true, recipes: true } } },
    });
    if (!original || original.businessId !== this.resolveBusinessId(user)) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.product.create({
        data: {
          businessId: original.businessId,
          name: `${original.name} (copia)`,
          category: original.category,
          description: original.description,
          imageUrl: original.imageUrl,
          productType: original.productType,
          isActive: false,
        },
      });

      for (const variant of original.variants) {
        const newVariant = await tx.productVariant.create({
          data: {
            businessId: original.businessId,
            productId: copy.id,
            name: variant.name,
            basePrice: variant.basePrice,
            isActive: variant.isActive,
          },
        });

        if (variant.branchPrices.length) {
          await tx.branchPrice.createMany({
            data: variant.branchPrices.map((bp) => ({ branchId: bp.branchId, variantId: newVariant.id, price: bp.price })),
          });
        }
        if (original.productType !== 'resale' && variant.recipes.length) {
          await tx.recipe.createMany({
            data: variant.recipes.map((r) => ({
              variantId: newVariant.id,
              ingredientId: r.ingredientId,
              quantity: r.quantity,
              applyCondition: r.applyCondition,
            })),
          });
        }
      }

      return { id: copy.id };
    });
  }

  async update(id: string, dto: UpdateProductDto, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const existingProduct = await this.prisma.product.findUnique({ where: { id }, select: { businessId: true, productType: true } });
    if (!existingProduct || existingProduct.businessId !== businessId) {
      throw new NotFoundException('Producto no encontrado');
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        description: dto.description,
        imageUrl: dto.image_url,
        ...(dto.product_type ? { productType: dto.product_type } : {}),
      },
    });

    // dto.product_type isn't always sent — fall back to the row's current
    // value so a partial update can't accidentally let stale recipes through.
    const productType = dto.product_type ?? existingProduct.productType;

    const existingVariants = await this.prisma.productVariant.findMany({
      where: { productId: id },
      select: { id: true, name: true },
    });
    const existingMap = new Map(existingVariants.map((v) => [v.name, v.id]));
    const incomingNames = new Set(dto.variants.map((v) => v.name));

    // Soft-deactivate variants that were removed (can't delete if referenced by order_items)
    for (const existing of existingVariants) {
      if (!incomingNames.has(existing.name)) {
        await this.prisma.productVariant.update({ where: { id: existing.id }, data: { isActive: false } });
      }
    }

    for (const variant of dto.variants) {
      let variantId = existingMap.get(variant.name);

      if (variantId) {
        await this.prisma.productVariant.update({
          where: { id: variantId },
          data: { basePrice: variant.base_price, isActive: true },
        });
      } else {
        const created = await this.prisma.productVariant.create({
          data: { businessId, productId: id, name: variant.name, basePrice: variant.base_price },
        });
        variantId = created.id;
      }

      await this.replaceVariantExtras(variantId, variant, productType);
    }
  }

  async setActive(id: string, isActive: boolean, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    await this.prisma.productVariant.updateMany({ where: { productId: id }, data: { isActive } });
    await this.prisma.product.update({ where: { id }, data: { isActive } });
  }

  // Hard delete real: a diferencia de setActive(id, false), esto borra
  // producto y variantes. Solo se permite si ninguna variante fue vendida
  // o está referenciada por una regla de promoción — lo demás
  // (branch_prices, recipes, stock) es config desechable, igual que en
  // replaceVariantExtras().
  async remove(id: string, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    const variants = await this.prisma.productVariant.findMany({ where: { productId: id }, select: { id: true } });
    const variantIds = variants.map((v) => v.id);

    await this.assertNoSalesOrPromoLinks(variantIds);

    await this.prisma.$transaction(async (tx) => {
      if (variantIds.length > 0) {
        await tx.branchPrice.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.recipe.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.branchProductStock.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productStockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.warehouseProductStock.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.warehouseProductMovement.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
      }
      await tx.product.delete({ where: { id } });
    });
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  // Evita que un admin del negocio B opere sobre un producto del negocio A
  // conociendo su UUID — 404 en vez de 403 para no revelar que el id existe.
  private async assertOwnership(id: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const product = await this.prisma.product.findUnique({ where: { id }, select: { businessId: true } });
    if (!product || product.businessId !== businessId) {
      throw new NotFoundException('Producto no encontrado');
    }
  }

  private async assertNoSalesOrPromoLinks(variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return;

    const [orderItem, orderItemFlavor, promotionRule] = await Promise.all([
      this.prisma.orderItem.findFirst({ where: { variantId: { in: variantIds } }, select: { id: true } }),
      this.prisma.orderItemFlavor.findFirst({ where: { variantId: { in: variantIds } }, select: { id: true } }),
      this.prisma.promotionRule.findFirst({ where: { variantId: { in: variantIds } }, select: { id: true } }),
    ]);

    if (orderItem || orderItemFlavor || promotionRule) {
      throw new ProductHasSalesException(
        'No se puede eliminar el producto: tiene ventas o promociones asociadas. Desactívalo en su lugar.',
      );
    }
  }

  private async replaceVariantExtras(
    variantId: string,
    variant: { branch_prices: { branch_id: string; price: number }[]; recipes: { ingredient_id: string; quantity: number; apply_condition?: string }[] },
    productType: string,
  ): Promise<void> {
    // recipes and branch_prices are config — safe to delete and recreate
    await this.prisma.branchPrice.deleteMany({ where: { variantId } });
    await this.prisma.recipe.deleteMany({ where: { variantId } });

    if (variant.branch_prices.length) {
      await this.prisma.branchPrice.createMany({
        data: variant.branch_prices.map((bp) => ({ branchId: bp.branch_id, variantId, price: bp.price })),
      });
    }

    // Resale products are sold as-is — never trust the client to have
    // cleared stale recipes when switching product_type away from "made".
    if (productType !== 'resale' && variant.recipes.length) {
      await this.prisma.recipe.createMany({
        data: variant.recipes.map((r) => ({
          variantId,
          ingredientId: r.ingredient_id,
          quantity: r.quantity,
          applyCondition: r.apply_condition ?? 'always',
        })),
      });
    }
  }

  private mapProduct(row: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    imageUrl: string | null;
    productType: string;
    createdAt: Date;
    isActive: boolean;
    variants: { id: string; productId: string; name: string; basePrice: { toNumber(): number }; createdAt: Date; isActive: boolean }[];
  }): Product {
    return {
      id: row.id,
      name: row.name,
      category: row.category as never,
      description: row.description,
      image_url: row.imageUrl,
      product_type: row.productType as never,
      created_at: row.createdAt.toISOString(),
      is_active: row.isActive,
      product_variants: row.variants.map((v) => ({
        id: v.id,
        product_id: v.productId,
        name: v.name,
        base_price: v.basePrice.toNumber(),
        created_at: v.createdAt.toISOString(),
        is_active: v.isActive,
      })),
    };
  }
}
