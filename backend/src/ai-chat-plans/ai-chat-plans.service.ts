import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AiChatPlanResult } from './types/ai-chat-plan.types';
import type { CreateAiChatPlanDto } from './dto/create-ai-chat-plan.dto';
import type { UpdateAiChatPlanDto } from './dto/update-ai-chat-plan.dto';

interface PlanLimits {
  messages_per_day?: number | null;
  model_id?: string | null;
  allowed_write_domains?: string[];
}

@Injectable()
export class AiChatPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive = false): Promise<AiChatPlanResult[]> {
    const rows = await this.prisma.aiChatPlan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toResult(row));
  }

  async create(dto: CreateAiChatPlanDto): Promise<AiChatPlanResult> {
    const row = await this.prisma.aiChatPlan.create({
      data: {
        name: dto.name,
        limits: {
          messages_per_day: dto.messages_per_day ?? null,
          model_id: dto.model_id ?? null,
          allowed_write_domains: dto.allowed_write_domains ?? [],
        },
      },
    });
    return this.toResult(row);
  }

  async update(id: string, dto: UpdateAiChatPlanDto): Promise<AiChatPlanResult> {
    const current = await this.prisma.aiChatPlan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Plan no encontrado');

    const currentLimits = (current.limits as PlanLimits) ?? {};
    const limits = {
      ...currentLimits,
      ...(dto.messages_per_day !== undefined ? { messages_per_day: dto.messages_per_day } : {}),
      ...(dto.model_id !== undefined ? { model_id: dto.model_id } : {}),
      ...(dto.allowed_write_domains !== undefined ? { allowed_write_domains: dto.allowed_write_domains } : {}),
    };

    const row = await this.prisma.aiChatPlan.update({
      where: { id },
      data: {
        name: dto.name,
        limits: limits as Prisma.InputJsonValue,
        isActive: dto.is_active,
      },
    });
    return this.toResult(row);
  }

  private toResult(row: {
    id: string;
    name: string;
    limits: unknown;
    isDefault: boolean;
    isActive: boolean;
    createdAt: Date;
  }): AiChatPlanResult {
    const limits = (row.limits as PlanLimits) ?? {};
    return {
      id: row.id,
      name: row.name,
      messages_per_day: limits.messages_per_day ?? null,
      model_id: limits.model_id ?? null,
      allowed_write_domains: limits.allowed_write_domains ?? [],
      is_default: row.isDefault,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
    };
  }
}
