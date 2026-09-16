import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { AnnouncementsService } from './announcements.service';
import { UpsertAnnouncementDto } from './dto/upsert-announcement.dto';

// Only the superadmin builds banners for businesses — same criteria as
// BusinessesController.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  list() {
    return this.announcementsService.list();
  }

  @Put(':businessId')
  upsert(@Param('businessId') businessId: string, @Body() dto: UpsertAnnouncementDto, @CurrentUser() user: CurrentUserPayload) {
    return this.announcementsService.upsert(businessId, dto, user);
  }

  @Delete(':businessId')
  remove(@Param('businessId') businessId: string) {
    return this.announcementsService.remove(businessId);
  }
}
