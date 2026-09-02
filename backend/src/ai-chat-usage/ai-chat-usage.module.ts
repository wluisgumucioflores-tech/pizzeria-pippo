import { Module } from '@nestjs/common';
import { AiChatQuotaService } from './ai-chat-quota.service';
import { AiChatUsageStatsService } from './ai-chat-usage-stats.service';

// Infrastructure module (mirror of SettingsModule): direct PrismaService,
// no domain logic — imported both by the chat-ia proxy (quota
// enforcement, Phase 9) and by BusinessesModule (stats for the superadmin).
@Module({
  providers: [AiChatQuotaService, AiChatUsageStatsService],
  exports: [AiChatQuotaService, AiChatUsageStatsService],
})
export class AiChatUsageModule {}
