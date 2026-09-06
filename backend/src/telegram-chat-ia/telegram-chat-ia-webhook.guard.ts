import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Resolves the business from the random webhookToken in the URL path (a bot
// token per business means a webhook URL per business — Telegram never sends
// the bot token in the update payload itself) and validates Telegram's own
// X-Telegram-Bot-Api-Secret-Token header against the secret generated when
// chat_ia_enabled was first turned on (SettingsService.registerTelegramWebhook).
// See docs/features/chat-ia-backend/plan-integracion-telegram.md, Fase 3.
@Injectable()
export class TelegramChatIaWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TelegramChatIaWebhookGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const webhookToken = request.params?.webhookToken;
    const config = webhookToken
      ? await this.prisma.telegramBotConfig.findUnique({ where: { webhookToken } })
      : null;
    if (!config?.webhookSecret) {
      this.logger.warn(`Webhook rechazado: token "${webhookToken}" no resuelve ninguna config`);
      throw new ForbiddenException();
    }

    const receivedSecret = request.headers['x-telegram-bot-api-secret-token'];
    if (receivedSecret !== config.webhookSecret) {
      this.logger.warn(`Webhook rechazado: secret no coincide (business ${config.businessId})`);
      throw new ForbiddenException();
    }

    request.telegramBotConfig = config;
    return true;
  }
}
