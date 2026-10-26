import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { OnlineOrdersService } from './online-orders.service';
import { ListOnlineOrdersQueryDto } from './dto/list-online-orders-query.dto';
import { RejectOnlineOrderDto } from './dto/reject-online-order.dto';

// MANAGEMENT controller — authenticated, admin/cajero only. The customer-facing
// endpoints are in public-online-orders.controller.ts and have no guard.
// Keep the two files separate so the auth boundary is obvious at a glance.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'cajero')
@Controller('online-orders')
export class OnlineOrdersController {
  constructor(private readonly service: OnlineOrdersService) {}

  @Get()
  list(
    @Query() query: ListOnlineOrdersQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.list(query.branchId, user);
  }

  // Creates the actual sale (order_type 'online', unpaid) and links it.
  @Post(':id/confirm')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.confirm(id, user);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOnlineOrderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.reject(id, dto, user);
  }
}
