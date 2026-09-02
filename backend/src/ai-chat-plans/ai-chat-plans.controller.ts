import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AiChatPlansService } from './ai-chat-plans.service';
import { CreateAiChatPlanDto } from './dto/create-ai-chat-plan.dto';
import { UpdateAiChatPlanDto } from './dto/update-ai-chat-plan.dto';

// Only the platform superadmin manages the Chat IA plan catalog —
// a business admin only consumes the plan that was assigned to them.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('ai-chat-plans')
export class AiChatPlansController {
  constructor(private readonly aiChatPlansService: AiChatPlansService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.aiChatPlansService.list(includeInactive === 'true');
  }

  @Post()
  create(@Body() dto: CreateAiChatPlanDto) {
    return this.aiChatPlansService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAiChatPlanDto) {
    return this.aiChatPlansService.update(id, dto);
  }
}
