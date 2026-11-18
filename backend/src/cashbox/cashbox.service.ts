import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { dateRangeFrom, dateRangeTo, todayInBolivia } from '../common/utils/timezone';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { OpenSessionDto } from './dto/open-session.dto';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { CloseSessionDto } from './dto/close-session.dto';
import type { ListCashSessionsQueryDto } from './dto/list-cash-sessions-query.dto';
import type {
  CashExpenseResult,
  CashSessionListRow,
  CashSessionResult,
} from './types/cashbox-result.types';

// Mismos tipos de Prisma que PrismaService.cashSession.findUnique({ include: ... })
// devuelve con estas relaciones — evita repetir el include en cada firma.
type SessionWithRelations = NonNullable<
  Awaited<ReturnType<CashboxService['findSessionWithRelations']>>
>;

@Injectable()
export class CashboxService {
  private readonly logger = new Logger(CashboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCurrentSession(
    branchId: string,
    user: CurrentUserPayload,
  ): Promise<CashSessionResult | null> {
    this.assertModuleEnabled(user);
    await this.assertBranchOwnership(branchId, user);

    const session = await this.prisma.cashSession.findFirst({
      where: { branchId, status: 'open' },
      include: this.sessionInclude(),
    });
    if (!session) return null;

    return this.toSessionResult(session);
  }

  async openSession(
    dto: OpenSessionDto,
    user: CurrentUserPayload,
  ): Promise<CashSessionResult> {
    this.assertModuleEnabled(user);
    await this.assertBranchOwnership(dto.branch_id, user);
    const businessId = this.resolveBusinessId(user);

    const existing = await this.prisma.cashSession.findFirst({
      where: { branchId: dto.branch_id, status: 'open' },
    });
    if (existing) {
      throw new ConflictException(
        'Ya hay una caja abierta en esta sucursal — cerrala antes de abrir otra.',
      );
    }

    const session = await this.prisma.cashSession.create({
      data: {
        businessId,
        branchId: dto.branch_id,
        openedBy: user.id,
        openingAmount: dto.opening_amount,
      },
      include: this.sessionInclude(),
    });
    return this.toSessionResult(session);
  }

  async createExpense(
    sessionId: string,
    dto: CreateExpenseDto,
    user: CurrentUserPayload,
  ): Promise<CashSessionResult> {
    this.assertModuleEnabled(user);
    const session = await this.findOwnedSessionOrThrow(sessionId, user);
    if (session.status !== 'open') {
      throw new ConflictException('Esta caja ya está cerrada.');
    }

    await this.prisma.cashExpense.create({
      data: {
        sessionId,
        businessId: session.businessId,
        branchId: session.branchId,
        amount: dto.amount,
        category: dto.category,
        note: dto.note?.trim() || null,
        createdBy: user.id,
      },
    });

    const updated = await this.findSessionWithRelations(sessionId);
    return this.toSessionResult(updated!);
  }

  async closeSession(
    sessionId: string,
    dto: CloseSessionDto,
    user: CurrentUserPayload,
  ): Promise<CashSessionResult> {
    this.assertModuleEnabled(user);
    const session = await this.findOwnedSessionOrThrow(sessionId, user);
    if (session.status !== 'open') {
      throw new ConflictException('Esta caja ya está cerrada.');
    }

    const cashSales = await this.computeCashSales(
      session.branchId,
      session.openedAt,
      new Date(),
    );
    const expensesTotal = session.expenses.reduce(
      (sum, e) => sum + e.amount.toNumber(),
      0,
    );
    const expected =
      session.openingAmount.toNumber() + cashSales - expensesTotal;
    const difference = round2(dto.counted_amount - expected);

    const updated = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        expectedAmount: round2(expected),
        countedAmount: dto.counted_amount,
        difference,
        closedBy: user.id,
        closedAt: new Date(),
      },
      include: this.sessionInclude(),
    });
    return this.toSessionResult(updated);
  }

  async listSessions(
    query: ListCashSessionsQueryDto,
    user: CurrentUserPayload,
  ): Promise<CashSessionListRow[]> {
    this.assertModuleEnabled(user);
    const businessId = this.resolveBusinessId(user);

    const sessions = await this.prisma.cashSession.findMany({
      where: {
        branch: { businessId },
        ...(query.branchId && { branchId: query.branchId }),
        ...((query.from || query.to) && {
          openedAt: {
            ...(query.from && { gte: new Date(dateRangeFrom(query.from)) }),
            ...(query.to && { lte: new Date(dateRangeTo(query.to)) }),
          },
        }),
      },
      include: {
        branch: { select: { name: true } },
        opener: { select: { fullName: true } },
        expenses: { select: { amount: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    return Promise.all(
      sessions.map(async (session) => {
        const expensesTotal = session.expenses.reduce(
          (sum, e) => sum + e.amount.toNumber(),
          0,
        );
        // Sesión cerrada: el cash_sales que importa es el que ya quedó
        // congelado en expected_amount al momento del cierre — recalcularlo
        // acá (abierta ventana hasta "ahora") daría un número distinto al
        // que el cajero vio al cerrar. Solo se recalcula en vivo para las
        // que siguen abiertas.
        const cashSales =
          session.status === 'open'
            ? await this.computeCashSales(
                session.branchId,
                session.openedAt,
                new Date(),
              )
            : (session.expectedAmount?.toNumber() ?? 0) -
              session.openingAmount.toNumber() +
              expensesTotal;

        return {
          id: session.id,
          opened_at: session.openedAt,
          branch_id: session.branchId,
          branch_name: session.branch.name,
          cashier_name: session.opener.fullName ?? 'Desconocido',
          opening_amount: session.openingAmount.toNumber(),
          cash_sales: round2(cashSales),
          expenses_total: round2(expensesTotal),
          counted_amount: session.countedAmount?.toNumber() ?? null,
          difference: session.difference?.toNumber() ?? null,
          status: session.status,
        };
      }),
    );
  }

  // Resuelve turnos que quedaron 'open' de un día anterior sin bloquear la
  // apertura del día siguiente — ver comentario en la migración 077. No
  // inventa un conteo: deja counted_amount/expected_amount en null y marca
  // 'auto_closed', visible como pendiente de revisión en el reporte.
  @Cron(CronExpression.EVERY_HOUR)
  async autoCloseStaleSessions(): Promise<void> {
    const todayStart = new Date(dateRangeFrom(todayInBolivia()));
    const stale = await this.prisma.cashSession.findMany({
      where: { status: 'open', openedAt: { lt: todayStart } },
      select: { id: true, branchId: true },
    });
    if (stale.length === 0) return;

    await this.prisma.cashSession.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: 'auto_closed', closedAt: new Date() },
    });
    this.logger.log(
      `${stale.length} caja(s) auto-cerrada(s) por quedar abiertas de un día anterior`,
    );
  }

  private sessionInclude() {
    return {
      opener: { select: { fullName: true } },
      closer: { select: { fullName: true } },
      expenses: {
        include: { creator: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private findSessionWithRelations(sessionId: string) {
    return this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: this.sessionInclude(),
    });
  }

  private async findOwnedSessionOrThrow(
    sessionId: string,
    user: CurrentUserPayload,
  ): Promise<SessionWithRelations> {
    const session = await this.findSessionWithRelations(sessionId);
    if (!session || session.businessId !== this.resolveBusinessId(user)) {
      throw new NotFoundException('Caja no encontrada');
    }
    return session;
  }

  // Suma lo que entró en efectivo en el rango [from, to) de una sucursal —
  // mismo criterio que ReportsService.getSales: una orden 'mixto' no tiene
  // un solo método, su pata en efectivo vive en order_payments.
  private async computeCashSales(
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        cancelledAt: null,
        createdAt: { gte: from, lte: to },
        paymentMethod: { in: ['efectivo', 'mixto'] },
      },
      select: { id: true, total: true, paymentMethod: true },
    });

    const cashOrders = orders.filter((o) => o.paymentMethod === 'efectivo');
    const cashTotal = cashOrders.reduce((sum, o) => sum + o.total.toNumber(), 0);

    const mixedOrders = orders.filter((o) => o.paymentMethod === 'mixto');
    if (mixedOrders.length === 0) return cashTotal;

    const mixedPayments = await this.prisma.orderPayment.findMany({
      where: { orderId: { in: mixedOrders.map((o) => o.id) }, method: 'efectivo' },
      select: { amount: true },
    });
    const mixedCashLeg = mixedPayments.reduce((sum, p) => sum + p.amount.toNumber(), 0);

    return cashTotal + mixedCashLeg;
  }

  private async toSessionResult(
    session: SessionWithRelations,
  ): Promise<CashSessionResult> {
    const expensesTotal = session.expenses.reduce(
      (sum, e) => sum + e.amount.toNumber(),
      0,
    );
    const expenses: CashExpenseResult[] = session.expenses.map((e) => ({
      id: e.id,
      amount: e.amount.toNumber(),
      category: e.category,
      note: e.note,
      created_at: e.createdAt,
      created_by_name: e.creator.fullName,
    }));

    if (session.status !== 'open') {
      return {
        id: session.id,
        branch_id: session.branchId,
        opening_amount: session.openingAmount.toNumber(),
        opened_at: session.openedAt,
        opened_by_name: session.opener.fullName,
        status: session.status,
        cash_sales: round2(
          (session.expectedAmount?.toNumber() ?? 0) -
            session.openingAmount.toNumber() +
            expensesTotal,
        ),
        expenses_total: round2(expensesTotal),
        expected_amount: session.expectedAmount?.toNumber() ?? 0,
        counted_amount: session.countedAmount?.toNumber() ?? null,
        difference: session.difference?.toNumber() ?? null,
        closed_at: session.closedAt,
        closed_by_name: session.closer?.fullName ?? null,
        expenses,
      };
    }

    // Abierta: no hay snapshot todavía, así que se calcula "hasta ahora"
    // para que el cajero vea en vivo cómo viene su turno.
    const cashSales = await this.computeCashSales(
      session.branchId,
      session.openedAt,
      new Date(),
    );
    return {
      id: session.id,
      branch_id: session.branchId,
      opening_amount: session.openingAmount.toNumber(),
      opened_at: session.openedAt,
      opened_by_name: session.opener.fullName,
      status: session.status,
      cash_sales: round2(cashSales),
      expenses_total: round2(expensesTotal),
      expected_amount: round2(
        session.openingAmount.toNumber() + cashSales - expensesTotal,
      ),
      counted_amount: null,
      difference: null,
      closed_at: null,
      closed_by_name: null,
      expenses,
    };
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException(
        'El usuario no tiene un negocio asociado',
      );
    }
    return user.business_id;
  }

  private assertModuleEnabled(user: CurrentUserPayload): void {
    if (!user.enabled_modules.cashbox) {
      throw new ForbiddenException(
        'El módulo de caja chica no está habilitado para este negocio',
      );
    }
  }

  // Mismo criterio que OrdersService.assertBranchOwnership: a nivel de
  // negocio, no de sucursal puntual del usuario — un cajero ya puede operar
  // sobre otra sucursal del mismo negocio en el resto del POS.
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
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
