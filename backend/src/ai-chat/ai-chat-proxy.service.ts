import { ForbiddenException, Injectable } from '@nestjs/common';
import { DEFAULT_ENABLED_MODULES, type EnabledModules } from '@pippo/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiChatQuotaService } from '../ai-chat-usage/ai-chat-quota.service';
import { BranchesService } from '../branches/branches.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { SendMessageDto } from './dto/send-message.dto';

interface AgentChatResponse {
  reply: string;
  promptTokens: number;
  completionTokens: number;
}

interface EffectiveBranch {
  id: string;
  name: string;
}

// Proxy to the Spring service (services/ai-orchestrator): gates by module
// flag + daily quota before forwarding, and logs the token consumption
// returned by the orchestrator when it finishes.
@Injectable()
export class AiChatProxyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: AiChatQuotaService,
    private readonly branchesService: BranchesService,
  ) {}

  async sendMessage(user: CurrentUserPayload, dto: SendMessageDto): Promise<{ content: string }> {
    const businessId = user.business_id;
    if (!businessId) {
      throw new ForbiddenException('Este usuario no pertenece a ningún negocio.');
    }

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true, enabledModules: true },
    });
    const enabledModules = { ...DEFAULT_ENABLED_MODULES, ...(business.enabledModules as Partial<EnabledModules>) };
    if (!enabledModules.aiChat) {
      throw new ForbiddenException('El chat IA no está habilitado para este negocio.');
    }

    const quota = await this.quotaService.checkAndIncrement(businessId);
    if (!quota.allowed) {
      throw new ForbiddenException(
        quota.limit === null
          ? 'Alcanzaste el límite de mensajes de tu plan.'
          : `Alcanzaste el límite diario de ${quota.limit} mensajes de tu plan ${quota.planName}.`,
      );
    }

    const lastUserMessage = [...dto.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      throw new ForbiddenException('No se encontró un mensaje del usuario para enviar.');
    }

    const branch = await this.resolveEffectiveBranch(user, dto.branch_id);
    const agentResponse = await this.callOrchestrator(
      businessId,
      user.id,
      user.role,
      lastUserMessage.content,
      dto.locale,
      branch,
      business.name,
    );
    await this.quotaService.addTokenUsage(businessId, agentResponse.promptTokens, agentResponse.completionTokens);

    return { content: agentResponse.reply };
  }

  // Picks the branch the orchestrator should default to, so the model doesn't
  // need to call getBranches or ask the user every turn (see catalogo-tools.md).
  // Reuses BranchesService.list()'s own role-scoping: a cajero/mesero only ever
  // sees their own branch, an admin sees all of the business's. Whichever set
  // is visible to this user, if it collapses to exactly one branch that's the
  // default; with more than one, only an explicit (and validated) dto.branch_id
  // picks one — otherwise it's "all branches", same as omitting branchId today.
  private async resolveEffectiveBranch(
    user: CurrentUserPayload,
    requestedBranchId: string | undefined,
  ): Promise<EffectiveBranch | null> {
    const visibleBranches = await this.branchesService.list({}, user);
    if (visibleBranches.length === 1) {
      return visibleBranches[0];
    }
    return visibleBranches.find((b) => b.id === requestedBranchId) ?? null;
  }

  // 30s covers a few LLM tool-calling round-trips (Spring AI's ChatClient
  // loop) — long enough for a real answer, short enough that a hung
  // orchestrator doesn't leave a caller (widget or Telegram webhook) waiting
  // forever. Any failure here (timeout, connection refused, non-2xx) becomes
  // the same user-facing ForbiddenException — safe to show as-is to whoever
  // is chatting, instead of leaking a raw network error.
  private async callOrchestrator(
    businessId: string,
    userId: string,
    role: string,
    message: string,
    locale: string | undefined,
    branch: EffectiveBranch | null,
    businessName: string,
  ): Promise<AgentChatResponse> {
    const baseUrl = process.env.AI_ORCHESTRATOR_URL ?? 'http://localhost:8090';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${baseUrl}/chat/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          businessId,
          locale,
          role,
          conversationId: `${businessId}:${userId}`,
          branchId: branch?.id,
          branchName: branch?.name,
          businessName,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ForbiddenException('El asistente IA no está disponible en este momento.');
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException('El asistente IA no está disponible en este momento.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
