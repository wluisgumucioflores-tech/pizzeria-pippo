import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PasswordModule } from '../auth/password/password.module';
import { AiChatUsageModule } from '../ai-chat-usage/ai-chat-usage.module';
import { BranchesModule } from '../branches/branches.module';
import { AiChatController } from './ai-chat.controller';
import { AiModelsController } from './ai-models.controller';
import { AiModelsService } from './ai-models.service';
import { AiPromptsService } from './ai-prompts.service';
import { AgentIdentityService } from './agent-identity.service';
import { AiChatProxyService } from './ai-chat-proxy.service';

// NestJS surface for the chat-ia orchestrator: runtime-config/system-prompt/
// agent-token (server-to-server, for the Spring service), message (proxy
// for the admin panel widget, with quota enforcement via AiChatUsageModule)
// and the model catalog (superadmin CRUD, Phase 1). BranchesModule is
// imported so AiChatProxyService can resolve the caller's effective branch
// (reuses BranchesService's own role-scoping instead of duplicating it).
// PrismaService is @Global.
@Module({
  imports: [AuthModule, PasswordModule, AiChatUsageModule, BranchesModule],
  controllers: [AiChatController, AiModelsController],
  providers: [AiModelsService, AiPromptsService, AgentIdentityService, AiChatProxyService],
  // Exported for the Telegram chat-ia webhook (backend/src/telegram-chat-ia),
  // which calls both in-process — same agent identity + proxy the admin
  // panel widget uses, no HTTP round-trip since it's the same Nest process.
  exports: [AgentIdentityService, AiChatProxyService],
})
export class AiChatModule {}
