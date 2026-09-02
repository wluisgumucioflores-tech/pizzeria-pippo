import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { todayInBolivia } from '../common/utils/timezone';

interface PlanLimits {
  messages_per_day?: number | null;
}

export interface QuotaCheckResult {
  allowed: boolean;
  limit: number | null;
  used: number;
  planName: string;
}

@Injectable()
export class AiChatQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  // Se llama antes de reenviar el mensaje al servicio orquestador (proxy
  // POST /ai-chat/message, ver Fase 9 del plan) — un plan con
  // messages_per_day null (ilimitado) nunca bloquea.
  async checkAndIncrement(businessId: string): Promise<QuotaCheckResult> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { aiChatPlan: true },
    });
    // aiChat enabled without a plan assigned is a superadmin misconfiguration
    // (aiChatPlanId is optional now — see migration 064), not "unlimited free
    // usage": block it visibly instead of silently letting it through.
    if (!business.aiChatPlan) {
      return { allowed: false, limit: 0, used: 0, planName: 'Sin plan asignado' };
    }
    const limits = (business.aiChatPlan.limits as PlanLimits) ?? {};
    const limit = limits.messages_per_day ?? null;
    const planName = business.aiChatPlan.name;

    const today = new Date(todayInBolivia());
    const usage = await this.prisma.aiChatUsage.findUnique({
      where: { businessId_date: { businessId, date: today } },
    });
    const used = usage?.messageCount ?? 0;

    if (limit !== null && used >= limit) {
      return { allowed: false, limit, used, planName };
    }

    await this.prisma.aiChatUsage.upsert({
      where: { businessId_date: { businessId, date: today } },
      create: { businessId, date: today, messageCount: 1 },
      update: { messageCount: used + 1, updatedAt: new Date() },
    });

    return { allowed: true, limit, used: used + 1, planName };
  }

  // Se llama al final de un turno de usuario, con los tokens que devuelva
  // el servicio orquestador para esa vuelta.
  async addTokenUsage(businessId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const today = new Date(todayInBolivia());
    await this.prisma.aiChatUsage.upsert({
      where: { businessId_date: { businessId, date: today } },
      create: { businessId, date: today, messageCount: 0, inputTokens, outputTokens },
      update: {
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        updatedAt: new Date(),
      },
    });
  }
}
