import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { LowStockAlertService } from '../notifications/low-stock-alert.service';
import { OrdersGateway } from './realtime/orders.gateway';
import { applyPromotions, getActivePromotions, getCartTotal } from './lib/promotions-engine';
import { computeStockDeductions } from './lib/order-stock';
import { dateRangeFrom, dateRangeTo, todayInBolivia } from '../common/utils/timezone';
import type { CartItem, Promotion } from './lib/promotions-engine';
import type { RecipeRow, StockItem } from './lib/order-stock';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { CreateOrderResult } from './types/create-order-result.types';
import type { DayOrderResult } from './types/day-order-result.types';
import type { KitchenOrderResult } from './types/kitchen-order-result.types';
import type { OrderType } from './lib/order-stock';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type CancellableOrder = Prisma.OrderGetPayload<{
  include: { items: { include: { flavors: true } }; branch: { select: { businessId: true } } };
}>;
type PrismaTransaction = Prisma.TransactionClient;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionsService: PromotionsService,
    private readonly lowStockAlertService: LowStockAlertService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async create(dto: CreateOrderDto, user: CurrentUserPayload): Promise<CreateOrderResult> {
    await this.assertBranchOwnership(dto.branch_id, user);

    // 1. Fetch variants (including mixed-pizza flavors) with prices, recipes and product info
    const flavorVariantIds = dto.items.flatMap((i) => (i.flavors ?? []).map((f) => f.variant_id));
    const variantIds = Array.from(new Set(dto.items.map((i) => i.variant_id).concat(flavorVariantIds)));

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { branchPrices: true, recipes: { include: { ingredient: true } }, product: true },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    // 2. Server-side price resolution — never trust client prices
    const cart: CartItem[] = dto.items.map((i) => {
      const variant = variantById.get(i.variant_id);
      if (!variant || !variant.isActive || !variant.product.isActive) {
        throw new BadRequestException('Hay productos no disponibles en el pedido');
      }
      const override = variant.branchPrices.find((bp) => bp.branchId === dto.branch_id);
      const productType = variant.product.productType ?? 'made';
      if (!override && productType !== 'resale') {
        throw new BadRequestException(`"${variant.product.name}" no tiene precio en esta sucursal`);
      }
      return {
        variant_id: i.variant_id,
        qty: i.qty,
        unit_price: override ? override.price.toNumber() : variant.basePrice.toNumber(),
        product_name: variant.product.name,
        variant_name: variant.name,
        category: variant.product.category,
        flavors: i.flavors?.length
          ? i.flavors.map((f) => ({ variant_id: f.variant_id, product_name: f.product_name ?? '', proportion: f.proportion }))
          : undefined,
        promo_id: i.promo_id ?? undefined,
      };
    });

    // 3. Recompute promotions and totals server-side (reuses PromotionsService's
    // query + mapping instead of duplicating it — same "all non-deleted promotions" set)
    const allPromotions = (await this.promotionsService.list({}, user)) as unknown as Promotion[];
    const activePromotions = getActivePromotions(allPromotions, dto.branch_id, todayInBolivia());
    const discounted = applyPromotions(cart, activePromotions);
    const serverTotal = round2(getCartTotal(discounted));

    // 4. The client total must match — a mismatch means prices/promos changed (or were tampered)
    if (Math.abs(serverTotal - dto.total) > 0.01) {
      throw new ConflictException('Los precios o promociones cambiaron. Actualizá el catálogo e intentá de nuevo.');
    }

    // 4b. Split payment (efectivo + qr) — the two legs must add up to the total and
    // use different methods; the order itself is stored as payment_method='mixto'.
    if (dto.payments) {
      const methods = new Set(dto.payments.map((p) => p.method));
      if (methods.size !== dto.payments.length) {
        throw new BadRequestException('El pago mixto no puede repetir el mismo método');
      }
      const paymentsSum = round2(dto.payments.reduce((sum, p) => sum + p.amount, 0));
      if (Math.abs(paymentsSum - serverTotal) > 0.01) {
        throw new BadRequestException('La suma de los montos del pago mixto no coincide con el total');
      }
    }

    // 5. Compute stock deductions (pure, unit-tested separately)
    const recipesByVariant: Record<string, RecipeRow[]> = {};
    for (const v of variants) {
      recipesByVariant[v.id] = v.recipes.map((r) => ({
        ingredient_id: r.ingredientId,
        quantity: r.quantity.toNumber(),
        apply_condition: r.applyCondition,
        is_shared_use: r.ingredient.isSharedUse,
      }));
    }

    const stockItems: StockItem[] = discounted.map((d) => ({
      variant_id: d.variant_id,
      qty_physical: d.qty_physical,
      product_type: variantById.get(d.variant_id)?.product.productType ?? 'made',
      flavors: d.flavors?.map((f) => ({ variant_id: f.variant_id, proportion: f.proportion })),
    }));
    const deductions = computeStockDeductions(stockItems, recipesByVariant, dto.order_type);
    if (deductions.incomplete_recipe_variant_ids.length > 0) {
      this.logger.warn(
        `Pedido con sabor(es) sin receta configurada: ${deductions.incomplete_recipe_variant_ids.join(', ')}. ` +
          `La venta se procesó igual, pero revisar la configuración de esas variantes.`,
      );
    }

    // 6. Apply order + items + flavors + stock in ONE transaction — reuses the
    // existing create_order_atomic SQL function (see plan doc for why this
    // isn't reimplemented in Prisma: advisory lock + idempotency race handling).
    const today = todayInBolivia();
    const payload = {
      branch_id: dto.branch_id,
      cashier_id: user.id,
      total: serverTotal,
      payment_method: dto.payments ? 'mixto' : dto.payment_method ?? null,
      payment_provider: dto.payment_provider ?? null,
      payments: dto.payments ?? [],
      order_type: dto.order_type,
      notes: dto.notes?.trim() || null,
      idempotency_key: dto.idempotency_key ?? null,
      day_start: dateRangeFrom(today),
      day_end: dateRangeTo(today),
      items: discounted.map((d) => ({
        variant_id: d.variant_id,
        qty: d.qty,
        qty_physical: d.qty_physical,
        unit_price: d.unit_price,
        discount_applied: round2(d.discount_applied),
        promo_label: d.promo_label,
        flavors: (d.flavors ?? []).map((f) => ({ variant_id: f.variant_id, proportion: f.proportion })),
      })),
      ...deductions,
    };

    const rows = await this.prisma.$queryRaw<{ create_order_atomic: CreateOrderResult }[]>`
      SELECT public.create_order_atomic(${JSON.stringify(payload)}::jsonb) AS create_order_atomic
    `;
    const result = rows[0].create_order_atomic;

    // 7. Low-stock alert — fire-and-forget, outside the "transaction" (best-effort)
    if (user.business_id && (deductions.ingredient_deductions.length > 0 || deductions.resale_deductions.length > 0)) {
      void this.lowStockAlertService.checkAndNotify(
        user.business_id,
        dto.branch_id,
        deductions.ingredient_deductions.map((d) => d.ingredient_id),
        deductions.resale_deductions.map((d) => d.variant_id),
      );
    }

    // 8. Live update for kitchen/POS — skip on an idempotency-key hit, the
    // order already existed and was already broadcast the first time.
    if (!result.duplicate) {
      this.ordersGateway.emitOrderCreated(dto.branch_id, { id: result.order_id, daily_number: result.daily_number });
    }

    return result;
  }

  async getDayOrders(branchId: string, date: string | undefined, user: CurrentUserPayload): Promise<DayOrderResult[]> {
    await this.assertBranchOwnership(branchId, user);
    const day = date ?? todayInBolivia();

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        createdAt: { gte: new Date(dateRangeFrom(day)), lte: new Date(dateRangeTo(day)) },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
      },
    });

    return orders.map((order) => ({
      id: order.id,
      daily_number: order.dailyNumber,
      created_at: order.createdAt.toISOString(),
      total: order.total.toNumber(),
      kitchen_status: order.kitchenStatus,
      payment_method: order.paymentMethod,
      payment_provider: order.paymentProvider,
      order_type: order.orderType,
      cancelled_at: order.cancelledAt?.toISOString() ?? null,
      notes: order.notes,
      order_items: order.items.map((item) => ({
        qty: item.qty,
        product_variants: item.variant
          ? { name: item.variant.name, products: item.variant.product ? { name: item.variant.product.name } : null }
          : null,
      })),
      payments: order.payments.map((p) => ({ method: p.method, amount: p.amount.toNumber() })),
    }));
  }

  async getPendingKitchenOrders(branchId: string, user: CurrentUserPayload): Promise<KitchenOrderResult[]> {
    await this.assertBranchOwnership(branchId, user);
    const orders = await this.prisma.order.findMany({
      where: { branchId, kitchenStatus: 'pending', cancelledAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
            flavors: { include: { variant: { include: { product: true } } } },
          },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      daily_number: order.dailyNumber,
      created_at: order.createdAt.toISOString(),
      kitchen_status: order.kitchenStatus,
      order_type: order.orderType,
      order_items: order.items.map((item) => ({
        id: item.id,
        qty: item.qty,
        qty_physical: item.qtyPhysical,
        product_variants: item.variant
          ? {
              name: item.variant.name,
              products: item.variant.product
                ? { name: item.variant.product.name, description: item.variant.product.description }
                : null,
            }
          : null,
        order_item_flavors: item.flavors.map((flavor) => ({
          variant_id: flavor.variantId,
          proportion: flavor.proportion.toNumber(),
          product_variants: flavor.variant
            ? { products: flavor.variant.product ? { name: flavor.variant.product.name } : null }
            : null,
        })),
      })),
    }));
  }

  async markReady(orderId: string, user: CurrentUserPayload): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { branchId: true, cancelledAt: true, branch: { select: { businessId: true } } },
    });
    if (!order || order.branch.businessId !== user.business_id) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (order.cancelledAt) throw new ConflictException('La orden está anulada');
    if (user.role !== 'admin' && user.branch_id !== order.branchId) {
      throw new ForbiddenException('No tenés permiso para esta orden');
    }

    await this.prisma.order.update({ where: { id: orderId }, data: { kitchenStatus: 'ready' } });
    this.ordersGateway.emitOrderUpdated(order.branchId, { id: orderId, kitchen_status: 'ready', cancelled_at: null });
  }

  async cancelOrder(orderId: string, dto: CancelOrderDto, user: CurrentUserPayload): Promise<void> {
    const reason = this.parseCancelReason(dto.reason);
    const order = await this.findCancellableOrderOrThrow(orderId, user);
    this.assertUserCanCancelOrder(order, user);

    const deductions = await this.computeReversalDeductions(order);
    const cancelledAt = await this.revertStockAndMarkCancelled(order, reason, user, deductions);

    this.ordersGateway.emitOrderUpdated(order.branchId, {
      id: order.id,
      kitchen_status: order.kitchenStatus,
      cancelled_at: cancelledAt.toISOString(),
    });
  }

  // Evita que un usuario pase el branchId de una sucursal de OTRO negocio
  // por query param — antes esto no se chequeaba en ningún GET de órdenes.
  private async assertBranchOwnership(branchId: string, user: CurrentUserPayload): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
    if (!branch || branch.businessId !== user.business_id) {
      throw new NotFoundException('Sucursal no encontrada');
    }
  }

  private parseCancelReason(rawReason: string): string {
    const reason = rawReason?.trim() ?? '';
    if (!reason) throw new BadRequestException('El motivo de anulación es requerido');
    return reason;
  }

  private async findCancellableOrderOrThrow(orderId: string, user: CurrentUserPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { flavors: true } }, branch: { select: { businessId: true } } },
    });
    if (!order || order.branch.businessId !== user.business_id) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (order.cancelledAt) throw new ConflictException('La orden ya fue anulada');
    return order;
  }

  private assertUserCanCancelOrder(order: CancellableOrder, user: CurrentUserPayload): void {
    if (user.role !== 'cajero') return;

    if (user.branch_id !== order.branchId) {
      throw new ForbiddenException('No tenés permiso para anular esta orden');
    }
    if (order.createdAt.toISOString().split('T')[0] !== todayInBolivia()) {
      throw new ForbiddenException('Solo podés anular órdenes del día actual');
    }
  }

  // Reconstructs the same StockItem[] shape used at sale time, to reuse
  // computeStockDeductions (pure, unit-tested) with the recipes as they are
  // configured today. Includes flavor variants (mixed pizzas), which have
  // their own recipes separate from the base variant.
  private async computeReversalDeductions(order: CancellableOrder) {
    const flavorVariantIds = order.items.flatMap((i) => i.flavors.map((f) => f.variantId));
    const variantIds = Array.from(new Set(order.items.map((i) => i.variantId).concat(flavorVariantIds)));
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { recipes: { include: { ingredient: true } }, product: true },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const recipesByVariant: Record<string, RecipeRow[]> = {};
    for (const v of variants) {
      recipesByVariant[v.id] = v.recipes.map((r) => ({
        ingredient_id: r.ingredientId,
        quantity: r.quantity.toNumber(),
        apply_condition: r.applyCondition,
        is_shared_use: r.ingredient.isSharedUse,
      }));
    }

    const stockItems: StockItem[] = order.items.map((item) => ({
      variant_id: item.variantId,
      qty_physical: item.qtyPhysical,
      product_type: variantById.get(item.variantId)?.product.productType ?? 'made',
      flavors: item.flavors.map((f) => ({ variant_id: f.variantId, proportion: f.proportion.toNumber() })),
    }));

    return computeStockDeductions(stockItems, recipesByVariant, order.orderType as OrderType);
  }

  // Everything below runs in one DB transaction: reverting stock, logging
  // the audit trail movements and marking the order cancelled either all
  // happens or none does (fixes the old non-atomic cancellation bug).
  private async revertStockAndMarkCancelled(
    order: CancellableOrder,
    reason: string,
    user: CurrentUserPayload,
    deductions: ReturnType<typeof computeStockDeductions>,
  ): Promise<Date> {
    const cancelledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, cancelledAt: null },
        data: { cancelledAt, cancelledBy: user.id, cancelReason: reason },
      });
      // Someone else cancelled it in the meantime (race) — abort, nothing to revert twice
      if (updated.count === 0) throw new ConflictException('La orden ya fue anulada');

      await this.revertIngredientStock(tx, order, deductions.ingredient_deductions, reason, user.id);
      // Reverts resale product stock too — the old Next.js route only reverted
      // ingredients, silently leaving resale stock short after a cancellation.
      await this.revertResaleStock(tx, order, deductions.resale_deductions, reason, user.id);
    });
    return cancelledAt;
  }

  private async revertIngredientStock(
    tx: PrismaTransaction,
    order: CancellableOrder,
    deductions: { ingredient_id: string; quantity: number }[],
    reason: string,
    userId: string,
  ): Promise<void> {
    for (const d of deductions) {
      await tx.branchStock.updateMany({
        where: { branchId: order.branchId, ingredientId: d.ingredient_id },
        data: { quantity: { increment: d.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          branchId: order.branchId,
          ingredientId: d.ingredient_id,
          quantity: d.quantity,
          type: 'anulacion',
          notes: `Anulación orden ${order.id}: ${reason}`,
          createdBy: userId,
        },
      });
    }
  }

  private async revertResaleStock(
    tx: PrismaTransaction,
    order: CancellableOrder,
    deductions: { variant_id: string; quantity: number }[],
    reason: string,
    userId: string,
  ): Promise<void> {
    for (const d of deductions) {
      await tx.branchProductStock.updateMany({
        where: { branchId: order.branchId, variantId: d.variant_id },
        data: { quantity: { increment: d.quantity } },
      });
      await tx.productStockMovement.create({
        data: {
          branchId: order.branchId,
          variantId: d.variant_id,
          quantity: d.quantity,
          type: 'anulacion',
          notes: `Anulación orden ${order.id}: ${reason}`,
          createdBy: userId,
        },
      });
    }
  }
}
