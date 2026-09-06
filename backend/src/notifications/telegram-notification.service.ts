import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { NotificationPort } from './notification.port';

@Injectable()
export class TelegramNotificationService implements NotificationPort {
  constructor(private readonly prisma: PrismaService) {}

  // Never throws — a notification failure must never block the calling flow
  // (matches the old sendTelegramAlert behavior, which swallowed all errors).
  async send(businessId: string, message: string): Promise<void> {
    try {
      const config = await this.prisma.telegramBotConfig.findUnique({
        where: { businessId },
      });

      if (!config?.isActive || !config.notificationsEnabled) return;
      const token = config.botToken;
      const chatId = config.chatId;
      if (!token || !chatId) return;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.error('[TelegramNotificationService] send error:', err);
    }
  }
}
