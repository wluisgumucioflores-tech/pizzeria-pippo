import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { todayInBolivia } from '../common/utils/timezone';
import type { AiChatUsageDay, AiChatUsageSummary, AiChatUsageToday } from './types/ai-chat-usage.types';

interface PlanLimits {
  messages_per_day?: number | null;
}

const BREAKDOWN_DAYS = 14;

@Injectable()
export class AiChatUsageStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayForBusiness(businessId: string): Promise<AiChatUsageToday> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { aiChatPlan: true },
    });
    const limits = (business.aiChatPlan?.limits as PlanLimits) ?? {};

    const today = new Date(todayInBolivia());
    const usage = await this.prisma.aiChatUsage.findUnique({
      where: { businessId_date: { businessId, date: today } },
    });

    return {
      plan_name: business.aiChatPlan?.name ?? null,
      limit: limits.messages_per_day ?? null,
      used: usage?.messageCount ?? 0,
    };
  }

  async getSummaryForBusiness(businessId: string): Promise<AiChatUsageSummary> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { aiChatPlan: true },
    });
    const limits = (business.aiChatPlan?.limits as PlanLimits) ?? {};

    const todayStr = todayInBolivia();
    const today = new Date(todayStr);
    const windowStart = startOfWindow(todayStr);

    const [lifetime, todayUsage, recentRows] = await Promise.all([
      this.prisma.aiChatUsage.aggregate({
        where: { businessId },
        _sum: { messageCount: true, inputTokens: true, outputTokens: true },
      }),
      this.prisma.aiChatUsage.findUnique({ where: { businessId_date: { businessId, date: today } } }),
      this.prisma.aiChatUsage.findMany({
        where: { businessId, date: { gte: windowStart } },
        orderBy: { date: 'asc' },
      }),
    ]);

    return {
      plan_name: business.aiChatPlan?.name ?? null,
      daily_limit: limits.messages_per_day ?? null,
      messages_today: todayUsage?.messageCount ?? 0,
      lifetime_messages: lifetime._sum.messageCount ?? 0,
      lifetime_input_tokens: lifetime._sum.inputTokens ?? 0,
      lifetime_output_tokens: lifetime._sum.outputTokens ?? 0,
      daily_breakdown: zeroFillBreakdown(todayStr, recentRows),
    };
  }
}

function startOfWindow(todayStr: string): Date {
  const d = new Date(todayStr);
  d.setUTCDate(d.getUTCDate() - (BREAKDOWN_DAYS - 1));
  return d;
}

function zeroFillBreakdown(
  todayStr: string,
  rows: { date: Date; messageCount: number; inputTokens: number; outputTokens: number }[],
): AiChatUsageDay[] {
  const byDate = new Map(rows.map((r) => [r.date.toISOString().split('T')[0], r]));
  const result: AiChatUsageDay[] = [];
  const cursor = new Date(todayStr);
  cursor.setUTCDate(cursor.getUTCDate() - (BREAKDOWN_DAYS - 1));

  for (let i = 0; i < BREAKDOWN_DAYS; i++) {
    const key = cursor.toISOString().split('T')[0];
    const row = byDate.get(key);
    result.push({
      date: key,
      messages: row?.messageCount ?? 0,
      input_tokens: row?.inputTokens ?? 0,
      output_tokens: row?.outputTokens ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
