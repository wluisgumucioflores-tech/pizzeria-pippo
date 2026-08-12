import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dateRangeFrom, dateRangeTo, toBoliviaDate } from '../common/utils/timezone';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { ReportQueryDto } from './dto/report-query.dto';
import type { CashierReportQueryDto } from './dto/cashier-report-query.dto';
import type { OrdersReportQueryDto } from './dto/orders-report-query.dto';
import type { CashierReportResult, TopProductResult } from './types/report-result.types';
import type { OrderReportResult } from './types/order-report-result.types';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: ReportQueryDto, user: CurrentUserPayload) {
    return {
      cancelledAt: null,
      // Fase 4 — cobro diferido: una orden sin cobrar todavía no es una
      // venta. Solo afecta a los reportes agregados (ventas, top productos,
      // por cajero) — el historial (buildOrdersHistoryWhere) sigue
      // mostrándolas, con una etiqueta de "pendiente de cobro".
      paymentMethod: { not: null },
      branch: { businessId: this.resolveBusinessId(user) },
      ...(query.branchId && { branchId: query.branchId }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(dateRangeFrom(query.from)) }),
          ...(query.to && { lte: new Date(dateRangeTo(query.to)) }),
        },
      }),
    };
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  async getSales(query: ReportQueryDto, user: CurrentUserPayload) {
    const orders = await this.prisma.order.findMany({
      where: this.buildWhere(query, user),
      select: { id: true, total: true, orderType: true, paymentMethod: true },
    });

    const total = orders.reduce((sum, o) => sum + o.total.toNumber(), 0);
    const count = orders.length;
    const avg = count > 0 ? total / count : 0;

    const dineIn = orders.filter((o) => o.orderType === 'dine_in');
    const takeaway = orders.filter((o) => o.orderType === 'takeaway');
    const delivery = orders.filter((o) => o.orderType === 'delivery');
    const pedidosYa = orders.filter((o) => o.orderType === 'pedidos_ya');

    const byMethod = (method: string) => orders.filter((o) => o.paymentMethod === method);
    const sumTotal = (rows: typeof orders) => rows.reduce((sum, o) => sum + o.total.toNumber(), 0);

    // Mixed orders don't carry a single method — their cash/qr split lives in
    // order_payments, and its two legs get folded into the efectivo/qr totals
    // below so "cuánto entró en efectivo hoy" stays accurate.
    const mixedOrders = orders.filter((o) => o.paymentMethod === 'mixto');
    const mixedPayments = mixedOrders.length
      ? await this.prisma.orderPayment.findMany({
          where: { orderId: { in: mixedOrders.map((o) => o.id) } },
          select: { method: true, amount: true },
        })
      : [];
    const sumMixedLeg = (method: string) =>
      mixedPayments.filter((p) => p.method === method).reduce((sum, p) => sum + p.amount.toNumber(), 0);

    return {
      total,
      count,
      avg,
      by_order_type: {
        dine_in: {
          total: sumTotal(dineIn),
          count: dineIn.length,
        },
        takeaway: {
          total: sumTotal(takeaway),
          count: takeaway.length,
        },
        delivery: {
          total: sumTotal(delivery),
          count: delivery.length,
        },
        pedidos_ya: {
          total: sumTotal(pedidosYa),
          count: pedidosYa.length,
        },
      },
      by_payment_method: {
        efectivo: { total: sumTotal(byMethod('efectivo')) + sumMixedLeg('efectivo'), count: byMethod('efectivo').length },
        qr: { total: sumTotal(byMethod('qr')) + sumMixedLeg('qr'), count: byMethod('qr').length },
        online: { total: sumTotal(byMethod('online')), count: byMethod('online').length },
        mixto: { count: mixedOrders.length },
        sin_especificar: {
          total: sumTotal(orders.filter((o) => !o.paymentMethod)),
          count: orders.filter((o) => !o.paymentMethod).length,
        },
      },
    };
  }

  async getDaily(query: ReportQueryDto, user: CurrentUserPayload): Promise<{ date: string; total: number }[]> {
    const orders = await this.prisma.order.findMany({
      where: this.buildWhere(query, user),
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const map: Record<string, number> = {};
    for (const order of orders) {
      const localDate = toBoliviaDate(order.createdAt);
      const date = localDate.toISOString().split('T')[0];
      map[date] = (map[date] ?? 0) + order.total.toNumber();
    }

    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTopProducts(query: ReportQueryDto, user: CurrentUserPayload): Promise<TopProductResult[]> {
    // Rank in the DB first (GROUP BY + LIMIT) instead of pulling every order_item
    // of the period into Node just to sort and slice — this is what made the
    // endpoint the slowest of the reports page (it scaled with total monthly
    // sales, not with the 5 rows actually shown).
    const topVariants = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { order: this.buildWhere(query, user) },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    });
    if (topVariants.length === 0) return [];

    const variantIds = topVariants.map((v) => v.variantId);
    const items = await this.prisma.orderItem.findMany({
      where: { order: this.buildWhere(query, user), variantId: { in: variantIds } },
      include: { variant: { include: { product: true } } },
    });

    const map: Record<string, TopProductResult> = {};
    for (const item of items) {
      const { variant } = item;
      if (!map[variant.id]) {
        map[variant.id] = {
          variant_id: variant.id,
          product_name: variant.product.name,
          variant_name: variant.name,
          category: variant.product.category,
          qty: 0,
          revenue: 0,
        };
      }
      map[variant.id].qty += item.qty;
      map[variant.id].revenue += item.unitPrice.toNumber() * item.qty - item.discountApplied.toNumber();
    }

    // groupBy already ranked these — keep that order instead of re-sorting.
    return variantIds.map((id) => map[id]).filter(Boolean);
  }

  async getCashiers(query: CashierReportQueryDto, user: CurrentUserPayload): Promise<CashierReportResult[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        ...this.buildWhere(query, user),
        // Fase 4 — atribuye al cajero que COBRÓ, no a quien creó la orden
        // (un pedido de mesero lo cobra un cajero distinto). buildWhere ya
        // filtra paymentMethod != null, así que paidById nunca es null acá.
        ...(query.cashierId && { paidById: query.cashierId }),
      },
      include: {
        paidBy: true,
        items: { include: { variant: { include: { product: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const cashierMap: Record<string, CashierReportResult> = {};
    for (const order of orders) {
      const cid = order.paidById;
      if (!cid) continue;
      if (!cashierMap[cid]) {
        cashierMap[cid] = {
          cashier_id: cid,
          cashier_name: order.paidBy?.fullName ?? 'Desconocido',
          orders: 0,
          total: 0,
          items: [],
        };
      }
      cashierMap[cid].orders += 1;
      cashierMap[cid].total += order.total.toNumber();

      for (const item of order.items) {
        const { variant } = item;
        const revenue = item.unitPrice.toNumber() * item.qty - item.discountApplied.toNumber();
        const existing = cashierMap[cid].items.find((i) => i.variant_id === variant.id);
        if (existing) {
          existing.qty += item.qty;
          existing.revenue += revenue;
        } else {
          cashierMap[cid].items.push({
            variant_id: variant.id,
            product_name: variant.product.name,
            variant_name: variant.name,
            category: variant.product.category,
            qty: item.qty,
            revenue,
          });
        }
      }
    }

    return Object.values(cashierMap).sort((a, b) => b.total - a.total);
  }

  async getOrders(query: OrdersReportQueryDto, user: CurrentUserPayload): Promise<{ data: OrderReportResult[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildOrdersHistoryWhere(query, user);

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          branch: true,
          cashier: true,
          items: { include: { variant: { include: { product: true } } } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data: orders.map((order) => this.mapOrderToReportResult(order)), total };
  }

  // Unlike buildWhere (used by the aggregate reports), the order history
  // shows cancelled orders too — the UI displays their cancel reason instead
  // of hiding them.
  private buildOrdersHistoryWhere(query: OrdersReportQueryDto, user: CurrentUserPayload) {
    return {
      branch: { businessId: this.resolveBusinessId(user) },
      ...(query.branchId && { branchId: query.branchId }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(dateRangeFrom(query.from)) }),
          ...(query.to && { lte: new Date(dateRangeTo(query.to)) }),
        },
      }),
    };
  }

  private mapOrderToReportResult(order: {
    id: string;
    dailyNumber: number;
    total: { toNumber(): number };
    createdAt: Date;
    branchId: string;
    paymentMethod: string | null;
    paymentProvider: string | null;
    orderType: string;
    cancelledAt: Date | null;
    cancelReason: string | null;
    notes: string | null;
    branch: { name: string } | null;
    cashier: { fullName: string | null } | null;
    items: {
      qty: number;
      unitPrice: { toNumber(): number };
      discountApplied: { toNumber(): number };
      promoLabel: string | null;
      priceEdited: boolean;
      variant: { name: string; product: { name: string; category: string } } | null;
    }[];
    payments: { method: string; amount: { toNumber(): number } }[];
  }): OrderReportResult {
    return {
      id: order.id,
      daily_number: order.dailyNumber,
      total: order.total.toNumber(),
      created_at: order.createdAt.toISOString(),
      branch_id: order.branchId,
      cashier_name: order.cashier?.fullName ?? '—',
      payment_method: order.paymentMethod,
      payment_provider: order.paymentProvider,
      order_type: order.orderType,
      cancelled_at: order.cancelledAt?.toISOString() ?? null,
      cancel_reason: order.cancelReason,
      notes: order.notes,
      branches: order.branch ? { name: order.branch.name } : null,
      order_items: order.items.map((item) => ({
        qty: item.qty,
        unit_price: item.unitPrice.toNumber(),
        discount_applied: item.discountApplied.toNumber(),
        promo_label: item.promoLabel,
        price_edited: item.priceEdited,
        product_variants: item.variant
          ? { name: item.variant.name, products: { name: item.variant.product.name, category: item.variant.product.category } }
          : null,
      })),
      payments: order.payments.map((p) => ({ method: p.method, amount: p.amount.toNumber() })),
    };
  }
}
