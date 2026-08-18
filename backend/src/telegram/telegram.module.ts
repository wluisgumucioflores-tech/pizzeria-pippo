import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { ReportsModule } from '../reports/reports.module';
import { StockModule } from '../stock/stock.module';
import { AiModule } from '../ai/ai.module';
import { TelegramChatsController } from './telegram-chats.controller';
import { TelegramChatsService } from './telegram-chats.service';
import { TelegramWebhookGuard } from './telegram-webhook.guard';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramAiService } from './telegram-ai.service';
import { TelegramQuotaService } from './telegram-quota.service';
import { TelegramSenderService } from './telegram-sender.service';

@Module({
  imports: [AuthModule, SettingsModule, ReportsModule, StockModule, AiModule],
  controllers: [TelegramChatsController, TelegramWebhookController],
  providers: [
    TelegramChatsService,
    TelegramWebhookGuard,
    TelegramAiService,
    TelegramQuotaService,
    TelegramSenderService,
  ],
})
export class TelegramModule {}
