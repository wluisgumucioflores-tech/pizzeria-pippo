import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AiModelsService } from './ai-models.service';
import { AiPromptsService } from './ai-prompts.service';
import { AgentIdentityService } from './agent-identity.service';
import { AiChatProxyService } from './ai-chat-proxy.service';
import { InternalTokenGuard } from './internal-token.guard';
import { IssueAgentTokenDto } from './dto/issue-agent-token.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

// Surface for the chat-ia orchestrator (Spring service): runtime-config,
// system-prompt, and agent-token are server-to-server (InternalTokenGuard,
// excluded from the OpenAPI spec). `message` is the only end-user route —
// used by the admin panel widget, protected with the user's normal JWT.
@ApiTags('ai-chat')
@Controller('ai-chat')
export class AiChatController {
  constructor(
    private readonly aiModelsService: AiModelsService,
    private readonly aiPromptsService: AiPromptsService,
    private readonly agentIdentityService: AgentIdentityService,
    private readonly aiChatProxyService: AiChatProxyService,
  ) {}

  // The orchestrator service asks which model to use. It doesn't expose credentials.
  // Phase 1: if it sends businessId, the model is determined by the business's plan
  // (ai_chat_plans.limits.model_id); without businessId (e.g. the pure
  // smoke-test /chat endpoint), it falls back to the global default — same
  // behavior as always.
  @Get('runtime-config')
  @UseGuards(InternalTokenGuard)
  @ApiExcludeEndpoint()
  getRuntimeConfig(@Query('businessId') businessId?: string) {
    return businessId
      ? this.aiModelsService.getRuntimeConfigForBusiness(businessId)
      : this.aiModelsService.getDefaultRuntimeConfig();
  }

  // The orchestrator service requests the current system prompt on every chat
  // turn. Editing the row in ai_prompts changes the agent's behavior
  // without recompiling or restarting any process.
  @Get('system-prompt')
  @UseGuards(InternalTokenGuard)
  @ApiExcludeEndpoint()
  getSystemPrompt(@Query('locale') locale?: string) {
    return this.aiPromptsService.getSystemPrompt(locale ?? 'es');
  }

  // The orchestrator service requests its own short-lived JWT to execute
  // tools against the business — the agent's identity, not that of the user who
  // opened the chat. Independent of backend/src/mcp (that's the surface
  // for external MCP clients, not for this orchestrator).
  @Post('agent-token')
  @UseGuards(InternalTokenGuard)
  @ApiExcludeEndpoint()
  issueAgentToken(@Body() dto: IssueAgentTokenDto) {
    return this.agentIdentityService.issueAgentToken(dto.businessId, dto.role);
  }

  // The admin panel chat widget sends the conversation history;
  // only the last user message is forwarded here — the context from previous
  // turns is kept by the Spring service's ChatMemory, per conversationId.
  // Only admin/cajero can talk to the agent — those are the two roles whose
  // write-tools we're building (products/categories: admin-only; promotions:
  // admin+cajero, still being designed).
  @Post('message')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'cajero')
  sendMessage(@Body() dto: SendMessageDto, @CurrentUser() user: CurrentUserPayload) {
    return this.aiChatProxyService.sendMessage(user, dto);
  }
}
