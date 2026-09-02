import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AiModelsService } from './ai-models.service';
import { CreateAiModelDto } from './dto/create-ai-model.dto';
import { UpdateAiModelDto } from './dto/update-ai-model.dto';

// Global catalog of AI models — only the superadmin manages it. Businesses
// do not choose a model directly: it's determined by the assigned plan
// (see AiChatPlansController / ai_chat_plans.limits.model_id).
@ApiTags('ai-models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('ai-models')
export class AiModelsController {
  constructor(private readonly aiModelsService: AiModelsService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.aiModelsService.list(includeInactive === 'true');
  }

  @Post()
  create(@Body() dto: CreateAiModelDto) {
    return this.aiModelsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAiModelDto) {
    return this.aiModelsService.update(id, dto);
  }
}
