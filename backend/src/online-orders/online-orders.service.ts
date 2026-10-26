import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersGateway } from '../orders/realtime/orders.gateway';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { RejectOnlineOrderDto } from './dto/reject-online-order.dto';
import { isActionable } from './lib/online-order.lib';
import type {
  ConfirmOnlineOrderResult,
  OnlineOrderResult,
} from './types/online-order-result.types';

// Management side of the QR ordering feature (admin/cajero). The public side
// lives in PublicOnlineOrdersService — this one always has a real user.
//
// The single most important thing here: confirming does NOT reimplement a
// sale. It calls OrdersService.create, which is the same path the POS uses,
// so the ticket number, the kitchen broadcast, the stock deduction and the
// idempotency handling all come for free and can't drift from a normal sale.
@Injectable()
export class OnlineOrdersService {
  private readonly logger = new Logger(OnlineOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  private assertModuleEnabled(user: CurrentUserPayload): void {
    if (!user.enabled_modules.onlineOrders) {
      throw new ForbiddenException(
        'El módulo de pedidos online no está habilitado para este negocio',
      );
    }
  }

  // Business-level, matching OrdersService.assertBranchOwnership — a cajero of
  // branch A can act on branch B of the same business, same as it already can
  // for normal sales. Deliberately not tightened here on its own.
  private async assertBranchOwnership(
    branchId: string,
    user: CurrentUserPayload,
  ): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { businessId: true },
    });
    if (!branch || branch.businessId !== user.business_id) {
      throw new NotFoundException('Sucursal no encontrada');
    }
  }

  async list(
    branchId: string,
    user: CurrentUserPayload,
  ): Promise<OnlineOrderResult[]> {
    this.assertModuleEnabled(user);
    await this.assertBranchOwnership(branchId, user);

    const orders = await this.prisma.onlineOrder.findMany({
      where: {
        branchId,
        status: 'pending',
        // Lazy expiry: an overdue request is filtered out here even if the
        // cron hasn't rewritten it yet, so the cashier never sees a row they
        // can't actually confirm.
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { dailyNumber: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    return orders.map((order) => this.toResult(order));
  }

  async confirm(
    id: string,
    user: CurrentUserPayload,
  ): Promise<ConfirmOnlineOrderResult> {
    this.assertModuleEnabled(user);

    const online = await this.prisma.onlineOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!online) throw new NotFoundException('Pedido online no encontrado');
    await this.assertBranchOwnership(online.branchId, user);

    if (!isActionable(online, new Date())) {
      throw new ConflictException(
        online.status === 'pending'
          ? 'Este pedido venció y ya no se puede confirmar'
          : 'Este pedido ya fue resuelto',
      );
    }

    // Deterministic key derived from the request id: a double click, two
    // cashiers racing, or a retry after a timeout all collapse onto the SAME
    // sale instead of creating a second one. create_order_atomic returns the
    // existing order for a repeated key.
    const result = await this.ordersService.create(
      {
        branch_id: online.branchId,
        total: online.total.toNumber(),
        order_type: 'online',
        // No payment_method on purpose → OrdersService leaves paid_by null,
        // i.e. the sale is born UNPAID and a cashier collects it when the
        // customer arrives. Same deferred-payment mechanism as mesero.
        notes: this.buildOrderNotes(online),
        idempotency_key: `online-${online.id}`,
        items: online.items.map((item) => ({
          variant_id: item.variantId,
          qty: item.qty,
        })),
      },
      user,
    );

    // Conditional on status still being 'pending': if another cashier won the
    // race, this updates 0 rows and we fall back to reporting their outcome.
    // The sale is the same one either way (shared idempotency key).
    const { count } = await this.prisma.onlineOrder.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'confirmed',
        orderId: result.order_id,
        resolvedAt: new Date(),
        resolvedBy: user.id,
      },
    });

    if (count === 0) {
      this.logger.warn(
        `Pedido online ${online.id} fue resuelto por otro usuario durante la confirmación`,
      );
    } else {
      this.ordersGateway.emitOnlineOrderResolved(online.branchId, {
        id: online.id,
        status: 'confirmed',
      });
    }

    return { order_id: result.order_id, daily_number: result.daily_number };
  }

  async reject(
    id: string,
    dto: RejectOnlineOrderDto,
    user: CurrentUserPayload,
  ): Promise<void> {
    this.assertModuleEnabled(user);

    const online = await this.prisma.onlineOrder.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true, expiresAt: true },
    });
    if (!online) throw new NotFoundException('Pedido online no encontrado');
    await this.assertBranchOwnership(online.branchId, user);

    // An already-resolved request can't be rejected, but an EXPIRED one can:
    // the business still wants to tell the customer why, and 'rejected' with
    // a reason is more useful to them than a bare 'expired'.
    if (online.status !== 'pending') {
      throw new ConflictException('Este pedido ya fue resuelto');
    }

    const { count } = await this.prisma.onlineOrder.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'rejected',
        rejectReason: dto.reason.trim(),
        resolvedAt: new Date(),
        resolvedBy: user.id,
      },
    });

    if (count === 0) {
      throw new ConflictException('Este pedido ya fue resuelto');
    }

    this.ordersGateway.emitOnlineOrderResolved(online.branchId, {
      id: online.id,
      status: 'rejected',
    });
  }

  // Runs alongside the lazy filter in list() — the filter guarantees nobody
  // can act on an overdue request, this guarantees the row eventually says so
  // (the customer's status screen and the admin's history read it).
  //
  // Safe to run on several backend instances: it only ever moves rows out of
  // 'pending', so a second instance finds nothing left to do.
  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdue(): Promise<void> {
    const overdue = await this.prisma.onlineOrder.findMany({
      where: { status: 'pending', expiresAt: { lte: new Date() } },
      select: { id: true, branchId: true },
    });
    if (overdue.length === 0) return;

    const { count } = await this.prisma.onlineOrder.updateMany({
      where: { id: { in: overdue.map((o) => o.id) }, status: 'pending' },
      data: { status: 'expired', resolvedAt: new Date() },
    });
    if (count === 0) return;

    this.logger.log(
      `${count} pedido(s) online vencido(s) por falta de atención`,
    );
    for (const order of overdue) {
      this.ordersGateway.emitOnlineOrderResolved(order.branchId, {
        id: order.id,
        status: 'expired',
      });
    }
  }

  // The customer's name and phone have nowhere else to live: `orders` has no
  // customer columns. Putting them in notes is what makes them show up on the
  // kitchen ticket and the printed receipt, which is where the cashier
  // actually needs them. Truncated to the column's 300-char DTO limit.
  private buildOrderNotes(online: {
    publicToken: string;
    customerName: string;
    customerPhone: string;
    notes: string | null;
  }): string {
    const reference = online.publicToken.slice(0, 6).toUpperCase();
    const parts = [
      `Pedido online #${reference}`,
      `${online.customerName} (${online.customerPhone})`,
    ];
    if (online.notes?.trim()) parts.push(online.notes.trim());
    return parts.join(' — ').slice(0, 300);
  }

  private toResult(order: {
    id: string;
    publicToken: string;
    branchId: string;
    customerName: string;
    customerPhone: string;
    total: { toNumber(): number };
    status: string;
    notes: string | null;
    rejectReason: string | null;
    createdAt: Date;
    expiresAt: Date;
    resolvedAt: Date | null;
    orderId: string | null;
    order: { dailyNumber: number } | null;
    items: {
      variantId: string;
      qty: number;
      unitPrice: { toNumber(): number };
      variant: { name: string; product: { name: string } };
    }[];
  }): OnlineOrderResult {
    return {
      id: order.id,
      reference: order.publicToken.slice(0, 6).toUpperCase(),
      branch_id: order.branchId,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      total: order.total.toNumber(),
      status: order.status,
      notes: order.notes,
      reject_reason: order.rejectReason,
      created_at: order.createdAt.toISOString(),
      expires_at: order.expiresAt.toISOString(),
      resolved_at: order.resolvedAt?.toISOString() ?? null,
      daily_number: order.order?.dailyNumber ?? null,
      order_id: order.orderId,
      items: order.items.map((item) => ({
        variant_id: item.variantId,
        product_name: item.variant.product.name,
        variant_name: item.variant.name,
        qty: item.qty,
        unit_price: item.unitPrice.toNumber(),
      })),
    };
  }
}
