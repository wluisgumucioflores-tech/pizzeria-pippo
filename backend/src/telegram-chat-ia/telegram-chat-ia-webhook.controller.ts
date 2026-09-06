import { Body, Controller, HttpException, Logger, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { TelegramBotConfig } from '@prisma/client';
import { AgentIdentityService } from '../ai-chat/agent-identity.service';
import { AiChatProxyService } from '../ai-chat/ai-chat-proxy.service';
import { TelegramSenderService } from '../telegram/telegram-sender.service';
import { TelegramChatIaWebhookGuard } from './telegram-chat-ia-webhook.guard';
import type { TelegramUpdatePayload } from '../telegram/types/telegram-update-payload.types';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

interface RequestWithBotConfig extends Request {
  telegramBotConfig: TelegramBotConfig;
}

// Public endpoint — Telegram calls this for every message sent to a
// business's own chat-ia bot (one bot/webhook per business, registered from
// Settings). Reuses the exact same AgentIdentityService + AiChatProxyService
// the admin panel widget uses — same tools, same quota, same orchestrator.
// See docs/features/chat-ia-backend/plan-integracion-telegram.md, Fase 3.
@Controller('telegram-chat-ia')
export class TelegramChatIaWebhookController {
  private readonly logger = new Logger(TelegramChatIaWebhookController.name);

  constructor(
    private readonly agentIdentityService: AgentIdentityService,
    private readonly aiChatProxyService: AiChatProxyService,
    private readonly telegramSenderService: TelegramSenderService,
  ) {}

  @UseGuards(TelegramChatIaWebhookGuard)
  @Post('webhook/:webhookToken')
  async handleWebhook(
    @Body() body: TelegramUpdatePayload,
    @Req() request: RequestWithBotConfig,
  ): Promise<{ ok: boolean }> {
    const config = request.telegramBotConfig;
    const message = body.message;

    if (!config.chatIaEnabled) {
      this.logger.warn(`Update recibido para business ${config.businessId} pero chat_ia_enabled está apagado`);
      return { ok: true };
    }
    if (!message?.text) {
      this.logger.debug(`Update sin texto ignorado (business ${config.businessId})`);
      return { ok: true };
    }
    if (String(message.chat.id) !== config.chatId) {
      this.logger.warn(
        `Update de chat no autorizado ignorado: recibido=${message.chat.id} esperado=${config.chatId} (business ${config.businessId})`,
      );
      return { ok: true };
    }

    // Telegram retries if it doesn't get a 200 within a few seconds — the LLM
    // can take longer than that, so ack immediately and answer asynchronously.
    void this.processMessage(config, message.text);
    return { ok: true };
  }

  private async processMessage(config: TelegramBotConfig, text: string): Promise<void> {
    try {
      const profile = await this.agentIdentityService.getOrCreateAgentProfile(config.businessId, 'admin');
      const user: CurrentUserPayload = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        branch_id: null,
        full_name: profile.fullName,
        business_id: profile.businessId,
      };
      const { content } = await this.aiChatProxyService.sendMessage(user, {
        messages: [{ role: 'user', content: text }],
        locale: 'es',
      });
      await this.telegramSenderService.sendMessage(config.botToken, config.chatId, content);
    } catch (err) {
      // HttpException messages here are the deliberate, user-facing ones
      // AiChatProxyService already throws (quota agotada, módulo deshabilitado,
      // orchestrator caído) — safe to show as-is. Anything else (network
      // errors, etc.) gets a generic message instead of a raw stack string.
      const errorMessage =
        err instanceof HttpException
          ? err.message
          : 'El chat IA no está disponible en este momento. Intentá de nuevo en un rato.';
      this.logger.error(`Error procesando mensaje de business ${config.businessId}: ${(err as Error)?.stack ?? err}`);
      await this.telegramSenderService
        .sendMessage(config.botToken, config.chatId, `⚠️ ${errorMessage}`)
        .catch((sendErr) => this.logger.error(`No se pudo enviar el mensaje de error a Telegram: ${sendErr}`));
    }
  }
}
