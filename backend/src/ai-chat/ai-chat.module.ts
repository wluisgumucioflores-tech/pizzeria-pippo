import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PasswordModule } from '../auth/password/password.module';
import { SettingsModule } from '../settings/settings.module';
import { AiModule } from '../ai/ai.module';
import { AiChatController } from './ai-chat.controller';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { QueryAgentService } from './agents/query-agent.service';
import { ToolRegistryService } from './tool-registry/tool-registry.service';
import { ToolExecutorService } from './api-client/tool-executor.service';
import { InternalKeyService } from './internal-key/internal-key.service';

// Intentionally does not import StockModule/ReportsModule/ProductsModule/etc.:
// the only link to the rest of the backend is HTTP (via ToolExecutorService)
// + the OpenAPI spec (via ToolRegistryService), no TypeScript imports.
@Module({
  imports: [AuthModule, PasswordModule, SettingsModule, AiModule],
  controllers: [AiChatController],
  providers: [
    OrchestratorService,
    QueryAgentService,
    ToolRegistryService,
    ToolExecutorService,
    InternalKeyService,
  ],
  exports: [ToolRegistryService],
})
export class AiChatModule {}
