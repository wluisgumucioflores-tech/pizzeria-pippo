import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../orders/realtime/orders.gateway';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { BufferedNotification, PendingPaymentRequest } from './types/pending-request.types';

const REQUEST_TTL_MS = (Number(process.env.PAYMENT_VALIDATION_WINDOW_MINUTES) || 5) * 60 * 1000;
const NOTIFICATION_BUFFER_TTL_MS = 2 * 60 * 1000;
// Amounts arrive as plain JS numbers (not Prisma Decimal, this state never
// touches the DB) — the epsilon absorbs float rounding, not a business tolerance.
const AMOUNT_EPSILON = 0.01;

// In-memory only (POC, single backend instance) — a restart drops any pending
// wait, the cashier just retries. Keyed by branch so multiple cashiers in
// different branches never interfere with each other's matching.
@Injectable()
export class PaymentValidationService {
  private readonly logger = new Logger(PaymentValidationService.name);
  private readonly pendingRequestsByBranch = new Map<string, PendingPaymentRequest[]>();
  private readonly bufferedNotificationsByBranch = new Map<string, BufferedNotification[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  // El branch_id viaja en el body del cajero — sin este chequeo, un cajero
  // del negocio B podría registrar una espera de pago sobre una sucursal
  // del negocio A pasando su UUID directamente.
  async start(branchId: string, user: CurrentUserPayload, amount: number): Promise<{ requestId: string }> {
    if (user.business_id) {
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
      if (!branch || branch.businessId !== user.business_id) {
        throw new NotFoundException('Sucursal no encontrada');
      }
    }

    this.pruneExpired(branchId);

    const request: PendingPaymentRequest = {
      id: randomUUID(),
      branchId,
      cashierId: user.id,
      amount,
      createdAt: Date.now(),
      rejectedNotificationIds: new Set(),
      matchedNotificationId: null,
    };
    this.pendingRequestsFor(branchId).push(request);

    // Handles the case where the payment notification arrived before the
    // cashier clicked "Validar pago" (a fast payer).
    this.tryMatchFromBuffer(request);

    return { requestId: request.id };
  }

  reject(requestId: string, notificationId: string): void {
    const request = this.findPendingRequest(requestId);
    if (!request) {
      throw new NotFoundException('La validación ya no está activa (expiró o fue cancelada)');
    }
    request.rejectedNotificationIds.add(notificationId);
    request.matchedNotificationId = null;
    this.tryMatchFromBuffer(request);
  }

  cancel(requestId: string): void {
    for (const requests of this.pendingRequestsByBranch.values()) {
      const index = requests.findIndex((r) => r.id === requestId);
      if (index !== -1) {
        requests.splice(index, 1);
        return;
      }
    }
  }

  reportNotification(branchId: string, amount: number, payerName: string, rawText: string): void {
    this.logger.log(`Notificación recibida — sucursal ${branchId}, monto ${amount}, remitente "${payerName}"`);
    this.pruneExpired(branchId);

    const notification: BufferedNotification = { id: randomUUID(), amount, payerName, rawText, receivedAt: Date.now() };
    // FIFO among requests not already showing a candidate to their cashier —
    // array is in insertion order, so the first match is the oldest pending request.
    const candidate = this.pendingRequestsFor(branchId).find(
      (r) => r.matchedNotificationId === null && this.amountsMatch(r.amount, amount),
    );

    if (candidate) {
      this.emitMatch(candidate, notification);
      return;
    }

    this.bufferedNotificationsFor(branchId).push(notification);
  }

  private tryMatchFromBuffer(request: PendingPaymentRequest): void {
    const notifications = this.bufferedNotificationsFor(request.branchId);
    const match = notifications.find(
      (n) => !request.rejectedNotificationIds.has(n.id) && this.amountsMatch(n.amount, request.amount),
    );
    if (!match) return;

    this.bufferedNotificationsByBranch.set(
      request.branchId,
      notifications.filter((n) => n.id !== match.id),
    );
    this.emitMatch(request, match);
  }

  private emitMatch(request: PendingPaymentRequest, notification: BufferedNotification): void {
    request.matchedNotificationId = notification.id;
    this.ordersGateway.emitPaymentMatched(request.branchId, {
      requestId: request.id,
      notificationId: notification.id,
      amount: notification.amount,
      payerName: notification.payerName,
      rawText: notification.rawText,
    });
  }

  private amountsMatch(a: number, b: number): boolean {
    return Math.abs(a - b) < AMOUNT_EPSILON;
  }

  private findPendingRequest(requestId: string): PendingPaymentRequest | undefined {
    for (const requests of this.pendingRequestsByBranch.values()) {
      const found = requests.find((r) => r.id === requestId);
      if (found) return found;
    }
    return undefined;
  }

  private pendingRequestsFor(branchId: string): PendingPaymentRequest[] {
    const requests = this.pendingRequestsByBranch.get(branchId) ?? [];
    this.pendingRequestsByBranch.set(branchId, requests);
    return requests;
  }

  private bufferedNotificationsFor(branchId: string): BufferedNotification[] {
    const notifications = this.bufferedNotificationsByBranch.get(branchId) ?? [];
    this.bufferedNotificationsByBranch.set(branchId, notifications);
    return notifications;
  }

  private pruneExpired(branchId: string): void {
    const now = Date.now();

    const requests = this.pendingRequestsFor(branchId).filter((r) => now - r.createdAt < REQUEST_TTL_MS);
    this.pendingRequestsByBranch.set(branchId, requests);

    const notifications = this.bufferedNotificationsFor(branchId).filter(
      (n) => now - n.receivedAt < NOTIFICATION_BUFFER_TTL_MS,
    );
    this.bufferedNotificationsByBranch.set(branchId, notifications);
  }
}
