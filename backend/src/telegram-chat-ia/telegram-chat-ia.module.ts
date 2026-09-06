import { Module } from '@nestjs/common';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { TelegramSenderService } from '../telegram/telegram-sender.service';
import { TelegramChatIaWebhookController } from './telegram-chat-ia-webhook.controller';
import { TelegramChatIaWebhookGuard } from './telegram-chat-ia-webhook.guard';

// Deliberately independent from TelegramModule (the old single-tenant
// reports bot) — this only needs AiChatModule (agent identity + proxy to the
// orchestrator) and the stateless TelegramSenderService, not
// TelegramModule's own AuthModule/SettingsModule/ReportsModule/StockModule
// imports. PrismaService is @Global.
@Module({
  imports: [AiChatModule],
  controllers: [TelegramChatIaWebhookController],
  providers: [TelegramChatIaWebhookGuard, TelegramSenderService],
})
export class TelegramChatIaModule {}
