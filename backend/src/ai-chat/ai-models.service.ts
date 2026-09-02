import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../common/utils/secret-crypto';
import type { CreateAiModelDto } from './dto/create-ai-model.dto';
import type { UpdateAiModelDto } from './dto/update-ai-model.dto';
import type { AiModelResult } from './types/ai-model.types';

export interface RuntimeConfig {
  provider: string;
  model: string;
  baseURL: string | null;
  apiKey: string | null;
  allowedWriteDomains: string[];
}

interface PlanLimits {
  model_id?: string | null;
  allowed_write_domains?: string[];
}

// A trailing/leading space silently pasted into base_url (very easy to do
// copying from a browser bar or docs) doesn't fail validation as a bad URL,
// but breaks the orchestrator's "does this end with /chat/completions?"
// check and gets URL-encoded into the actual HTTP call (%20) — a confusing
// 400 from the provider instead of an obvious error here.
function sanitizeBaseUrl(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

@Injectable()
export class AiModelsService {
  constructor(private readonly prisma: PrismaService) {}

  // Model catalog: only the superadmin manages it (Phase 1/8). Cloud
  // providers' API key is stored encrypted (secret-crypto.ts) — list()
  // never returns the value, only whether it's configured.
  async list(includeInactive = false): Promise<AiModelResult[]> {
    const rows = await this.prisma.aiModel.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toResult(row));
  }

  async create(dto: CreateAiModelDto): Promise<AiModelResult> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.aiModel.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.aiModel.create({
        data: {
          provider: dto.provider,
          modelId: dto.model_id,
          label: dto.label,
          baseUrl: sanitizeBaseUrl(dto.base_url),
          apiKey: dto.api_key ? encryptSecret(dto.api_key) : null,
          isLocal: dto.is_local ?? false,
          isActive: dto.is_active ?? true,
          isDefault: dto.is_default ?? false,
        },
      });
    });
    return this.toResult(row);
  }

  async update(id: string, dto: UpdateAiModelDto): Promise<AiModelResult> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.aiModel.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return tx.aiModel.update({
        where: { id },
        data: {
          provider: dto.provider,
          modelId: dto.model_id,
          label: dto.label,
          baseUrl: dto.base_url !== undefined ? sanitizeBaseUrl(dto.base_url) : undefined,
          // Empty/omitted = don't touch the stored key; the form never
          // preloads it (it never leaves the DB in plain text), so "no
          // changes" has to mean "keep the one that was already there".
          apiKey: dto.api_key ? encryptSecret(dto.api_key) : undefined,
          isLocal: dto.is_local,
          isActive: dto.is_active,
          isDefault: dto.is_default,
        },
      });
    });
    return this.toResult(row);
  }

  // Resolves the active default model from the global catalog — fallback
  // for when a business (or its plan) doesn't have its own model configured.
  async getDefaultRuntimeConfig(): Promise<RuntimeConfig> {
    const model = await this.prisma.aiModel.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!model) {
      throw new NotFoundException(
        'No hay un modelo de IA por defecto activo configurado (tabla ai_models).',
      );
    }
    // No plan context here (smoke-test /chat endpoint) — no write domain enabled.
    return { ...this.toRuntimeConfig(model), allowedWriteDomains: [] };
  }

  // Phase 1: the model is determined by the business's plan (limits.model_id), not
  // by the business itself — there's no selector in the admin panel yet. If the
  // business has no plan assigned, the plan has no model assigned, or the assigned
  // one became inactive, it falls back to the global default so the business
  // isn't left without service. allowedWriteDomains always comes from the
  // business's own plan, even when the model itself falls back to the default.
  async getRuntimeConfigForBusiness(businessId: string): Promise<RuntimeConfig> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { aiChatPlan: true },
    });
    const limits = (business.aiChatPlan?.limits as PlanLimits) ?? {};
    const allowedWriteDomains = limits.allowed_write_domains ?? [];

    if (limits.model_id) {
      const model = await this.prisma.aiModel.findUnique({ where: { id: limits.model_id } });
      if (model?.isActive) {
        return { ...this.toRuntimeConfig(model), allowedWriteDomains };
      }
    }
    const fallback = await this.getDefaultRuntimeConfig();
    return { ...fallback, allowedWriteDomains };
  }

  // Phase 8: the API key comes out decrypted ONLY here — this method is
  // consumed exclusively by the server-to-server /ai-chat/runtime-config endpoint
  // (InternalTokenGuard), never a response the superadmin sees.
  // allowedWriteDomains isn't part of this method's output on purpose — it comes from
  // the plan, not the model, and every caller adds it right after via object spread.
  private toRuntimeConfig(model: {
    provider: string;
    modelId: string;
    baseUrl: string | null;
    apiKey: string | null;
  }): Omit<RuntimeConfig, 'allowedWriteDomains'> {
    return {
      provider: model.provider,
      model: model.modelId,
      baseURL: model.baseUrl,
      apiKey: model.apiKey ? decryptSecret(model.apiKey) : null,
    };
  }

  private toResult(row: {
    id: string;
    provider: string;
    modelId: string;
    label: string;
    baseUrl: string | null;
    apiKey: string | null;
    isLocal: boolean;
    isActive: boolean;
    isDefault: boolean;
    createdAt: Date;
  }): AiModelResult {
    return {
      id: row.id,
      provider: row.provider,
      model_id: row.modelId,
      label: row.label,
      base_url: row.baseUrl,
      has_api_key: row.apiKey !== null,
      is_local: row.isLocal,
      is_active: row.isActive,
      is_default: row.isDefault,
      created_at: row.createdAt.toISOString(),
    };
  }
}
