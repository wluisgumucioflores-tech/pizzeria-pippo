import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { TelegramChatsService } from './telegram-chats.service';
import { TelegramQuotaService } from './telegram-quota.service';
import { TelegramAiService } from './telegram-ai.service';
import { TelegramSenderService } from './telegram-sender.service';
import { TelegramWebhookGuard } from './telegram-webhook.guard';
import type { TelegramUpdatePayload } from './types/telegram-update-payload.types';

const WEBHOOK_SETTINGS_KEYS = ['telegram_ai_enabled', 'telegram_bot_token'];

@ApiTags('telegram')
@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly telegramChatsService: TelegramChatsService,
    private readonly telegramQuotaService: TelegramQuotaService,
    private readonly telegramAiService: TelegramAiService,
    private readonly telegramSenderService: TelegramSenderService,
  ) {}

  // Public endpoint — Telegram calls this for every message received by the bot.
  // Auth is verified by TelegramWebhookGuard via X-Telegram-Bot-Api-Secret-Token.
  @UseGuards(TelegramWebhookGuard)
  @Post('webhook')
  async handleWebhook(@Body() body: TelegramUpdatePayload): Promise<{ ok: boolean }> {
    const settings = await this.settingsService.getRawSettingsForFirstBusiness(WEBHOOK_SETTINGS_KEYS);

    if (settings['telegram_ai_enabled'] !== 'true') {
      return { ok: true }; // bot disabled — silently ignore
    }

    const message = body.message;
    if (!message?.text) {
      return { ok: true }; // ignore non-text updates (stickers, photos, etc.)
    }

    const chatId = String(message.chat.id);
    const chatType = message.chat.type; // "private", "group", "supergroup"
    const text = message.text;

    const authorizedChat = await this.telegramChatsService.findByChatId(chatId);
    if (!authorizedChat?.isActive) {
      return { ok: true }; // not authorized — ignore silently
    }

    // For group chats: process all text messages (members are assumed to be admins).
    // For personal chats: process directly. (Future: could require @mention in groups.)
    const isGroup = chatType === 'group' || chatType === 'supergroup';
    if (isGroup && authorizedChat.type !== 'group') {
      return { ok: true };
    }

    const botToken = settings['telegram_bot_token'] ?? '';
    if (!botToken) {
      return { ok: true };
    }

    const quota = await this.telegramQuotaService.checkAndIncrement(chatId, authorizedChat.plan);
    if (!quota.allowed) {
      const planName = authorizedChat.plan.charAt(0).toUpperCase() + authorizedChat.plan.slice(1);
      await this.telegramSenderService.sendMessage(
        botToken,
        chatId,
        `⛔ Alcanzaste el límite de ${quota.limit} mensajes por día del plan ${planName}.\n\nTu cuota se renueva mañana a las 00:00.`,
      );
      return { ok: true };
    }

    const response = await this.telegramAiService.processMessage(text);

    if (response.type === 'file' && Buffer.isBuffer(response.content)) {
      await this.telegramSenderService.sendDocument(botToken, chatId, response.content, response.filename ?? 'reporte.xlsx');
    } else {
      await this.telegramSenderService.sendMessage(botToken, chatId, String(response.content));
    }

    return { ok: true };
  }
}
