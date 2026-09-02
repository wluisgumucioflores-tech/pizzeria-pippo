import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { AiChatUsageStatsService } from '../ai-chat-usage/ai-chat-usage-stats.service';

// Only the platform superadmin manages businesses — a business
// admin has no reason to see or touch this endpoint.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly aiChatUsageStatsService: AiChatUsageStatsService,
  ) {}

  @Get()
  list() {
    return this.businessesService.list();
  }

  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, dto);
  }

  @Get(':id/ai-chat-usage')
  getAiChatUsage(@Param('id') id: string) {
    return this.aiChatUsageStatsService.getSummaryForBusiness(id);
  }
}
