import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { EnabledModules } from '@pippo/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OrdersGateway } from '../orders/realtime/orders.gateway';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import {
  buildOrderMessage,
  buildWhatsAppLink,
  computeOrderTotal,
  expiresAtFrom,
  isExpired,
  type PricedLine,
} from './lib/online-order.lib';
import {
  filterVisibleProducts,
  isProductVisibleOnline,
  type MenuVisibilityConfig,
} from './lib/online-menu-filter';
import type { PublicMenuResult } from './types/public-menu-result.types';
import type {
  CreatePublicOrderResult,
  PublicOrderStatusResult,
} from './types/public-order-result.types';

// Everything a customer with the QR link can reach. No JWT anywhere in here:
// the tenant is derived from the branch id in the scanned URL, never from a
// user. See docs/features/pedidos-online-qr/.
//
// Two rules this service exists to enforce, and that must never be relaxed:
//   1. Prices come from the database, never from the request body.
//   2. A variant can only be ordered if its product is visible on the public
//      menu — otherwise the menu filter would be cosmetic and anyone could
//      order a hidden product by posting its id.
@Injectable()
export class PublicOnlineOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  // One generic 404 for "branch doesn't exist", "branch is inactive" and
  // "module is off". A public endpoint shouldn't let a stranger probe which
  // branch ids are real.
  private notAvailable(): NotFoundException {
    return new NotFoundException('Este menú no está disponible');
  }

  private async resolveBranchContext(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { business: true },
    });

    if (!branch || !branch.isActive || !branch.business.isActive) {
      throw this.notAvailable();
    }

    const modules = branch.business.enabledModules as Partial<EnabledModules>;
    // Hiding the UI is not enough — with the module off the endpoint itself
    // must refuse, or an old QR would keep taking orders nobody is watching.
    if (modules?.onlineOrders !== true) {
      throw this.notAvailable();
    }

    return { branch, businessId: branch.businessId };
  }

  async getMenu(branchId: string): Promise<PublicMenuResult> {
    const { branch, businessId } = await this.resolveBranchContext(branchId);
    const [config, useStock] = await Promise.all([
      this.settingsService.getOnlineOrdersConfig(businessId),
      this.settingsService.isStockTrackingEnabledForBusiness(businessId),
    ]);

    const products = await this.loadSellableProducts(businessId, branchId, {
      mode: config.menuMode,
      categoryIds: config.categoryIds,
      productIds: config.productIds,
    });

    const visible = useStock
      ? await this.dropOutOfStockResale(products, branchId)
      : products;

    return {
      business_name: branch.business.name,
      branch_id: branch.id,
      branch_name: branch.name,
      whatsapp_configured: config.whatsapp.trim() !== '',
      products: visible.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        image_url: p.imageUrl,
        category_id: p.categoryId,
        category_name: p.categoryRef?.name ?? null,
        variants: p.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: this.resolvePrice(v, p.productType, branchId),
        })),
      })),
    };
  }

  async createOrder(
    dto: CreatePublicOrderDto,
  ): Promise<CreatePublicOrderResult> {
    const { branch, businessId } = await this.resolveBranchContext(
      dto.branch_id,
    );
    const config = await this.settingsService.getOnlineOrdersConfig(businessId);

    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: dto.items.map((i) => i.variant_id) },
        businessId,
      },
      include: {
        branchPrices: { where: { branchId: dto.branch_id } },
        product: true,
      },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const visibility: MenuVisibilityConfig = {
      mode: config.menuMode,
      categoryIds: config.categoryIds,
      productIds: config.productIds,
    };

    const lines: PricedLine[] = dto.items.map((item) => {
      const variant = variantById.get(item.variant_id);
      // Same opaque message for every reason (unknown id, inactive, hidden by
      // the menu filter, no price in this branch): a public caller doesn't
      // get to learn which products exist but are hidden.
      if (
        !variant ||
        !variant.isActive ||
        !variant.product.isActive ||
        !isProductVisibleOnline(
          { id: variant.productId, categoryId: variant.product.categoryId },
          visibility,
        )
      ) {
        throw new BadRequestException(
          'Hay productos que ya no están disponibles. Actualizá el menú e intentá de nuevo.',
        );
      }

      return {
        productName: variant.product.name,
        variantName: variant.name,
        qty: item.qty,
        unitPrice: this.resolvePrice(
          variant,
          variant.product.productType,
          dto.branch_id,
        ),
      };
    });

    const total = computeOrderTotal(lines);
    const publicToken = randomBytes(24).toString('hex');
    const reference = publicToken.slice(0, 6).toUpperCase();
    const createdAt = new Date();
    const expiresAt = expiresAtFrom(createdAt, config.expireMinutes);

    const created = await this.prisma.onlineOrder.create({
      data: {
        businessId,
        branchId: dto.branch_id,
        customerName: dto.customer_name.trim(),
        customerPhone: dto.customer_phone.trim(),
        total,
        publicToken,
        notes: dto.notes?.trim() || null,
        expiresAt,
        items: {
          create: dto.items.map((item, idx) => ({
            variantId: item.variant_id,
            qty: item.qty,
            unitPrice: lines[idx].unitPrice,
          })),
        },
      },
      select: { id: true, createdAt: true },
    });

    // Live badge + sound on the cashier's screen. This is the notification the
    // business actually relies on — the WhatsApp message below depends on the
    // customer pressing send, which we can never verify.
    this.ordersGateway.emitOnlineOrderCreated(dto.branch_id, {
      id: created.id,
      reference,
      customer_name: dto.customer_name.trim(),
      total,
      created_at: created.createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    const message = buildOrderMessage({
      businessName: branch.business.name,
      branchName: branch.name,
      customerName: dto.customer_name.trim(),
      customerPhone: dto.customer_phone.trim(),
      lines,
      total,
      notes: dto.notes,
      reference,
    });

    return {
      public_token: publicToken,
      reference,
      total,
      expires_at: expiresAt.toISOString(),
      whatsapp_url: buildWhatsAppLink(config.whatsapp, message),
    };
  }

  async getStatus(token: string): Promise<PublicOrderStatusResult> {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { publicToken: token },
      include: {
        order: { select: { dailyNumber: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    // Reported as expired the moment the window closes, without waiting for
    // the cron to rewrite the row — the customer must never be told "pending"
    // for an order nobody can confirm any more.
    const status = isExpired(order, new Date())
      ? 'expired'
      : (order.status as PublicOrderStatusResult['status']);

    return {
      reference: order.publicToken.slice(0, 6).toUpperCase(),
      status,
      total: order.total.toNumber(),
      created_at: order.createdAt.toISOString(),
      expires_at: order.expiresAt.toISOString(),
      items: order.items.map((item) => ({
        product_name: item.variant.product.name,
        variant_name: item.variant.name,
        qty: item.qty,
        unit_price: item.unitPrice.toNumber(),
      })),
      daily_number: order.order?.dailyNumber ?? null,
      reject_reason: order.rejectReason,
    };
  }

  // Mirrors the POS catalog rule (ProductsService.getPosCatalog): a product
  // made in-house is only sellable in a branch that has an explicit price for
  // it; a resale product falls back to its base price.
  private resolvePrice(
    variant: {
      basePrice: { toNumber(): number };
      branchPrices: { branchId: string; price: { toNumber(): number } }[];
    },
    productType: string,
    branchId: string,
  ): number {
    const override = variant.branchPrices.find(
      (bp) => bp.branchId === branchId,
    );
    if (override) return override.price.toNumber();
    if (productType === 'resale') return variant.basePrice.toNumber();
    throw new BadRequestException(
      'Hay productos sin precio configurado en esta sucursal',
    );
  }

  private async loadSellableProducts(
    businessId: string,
    branchId: string,
    visibility: MenuVisibilityConfig,
  ) {
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        categoryRef: { select: { name: true } },
        variants: {
          where: { isActive: true },
          orderBy: { basePrice: 'asc' },
          include: { branchPrices: { where: { branchId } } },
        },
      },
    });

    return filterVisibleProducts(products, visibility)
      .map((p) => ({
        ...p,
        // Drop what this branch can't actually sell, instead of letting
        // resolvePrice throw while rendering a menu.
        variants: p.variants.filter(
          (v) => v.branchPrices.length > 0 || p.productType === 'resale',
        ),
      }))
      .filter((p) => p.variants.length > 0);
  }

  private async dropOutOfStockResale<
    T extends { productType: string; variants: { id: string }[] },
  >(products: T[], branchId: string): Promise<T[]> {
    const resaleVariantIds = products.flatMap((p) =>
      p.productType === 'resale' ? p.variants.map((v) => v.id) : [],
    );
    if (resaleVariantIds.length === 0) return products;

    const stockRows = await this.prisma.branchProductStock.findMany({
      where: { branchId, variantId: { in: resaleVariantIds } },
    });
    const stockByVariant = new Map(
      stockRows.map((r) => [r.variantId, r.quantity.toNumber()]),
    );

    return products
      .map((p) =>
        p.productType === 'resale'
          ? {
              ...p,
              // No stock row at all means "never stocked here" → hide it too.
              variants: p.variants.filter(
                (v) => (stockByVariant.get(v.id) ?? 0) > 0,
              ),
            }
          : p,
      )
      .filter((p) => p.variants.length > 0);
  }
}
