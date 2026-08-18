import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { InternalKeyService } from './internal-key/internal-key.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('ai-chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('ai-chat')
export class AiChatController {
  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly internalKeyService: InternalKeyService,
  ) {}

  @Post('message')
  sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.orchestrator.handleMessage(user, dto.messages, dto.locale);
  }

  @Post('internal-key/generate')
  generateInternalKey(@CurrentUser() user: CurrentUserPayload) {
    return this.internalKeyService.generate(user);
  }
}
