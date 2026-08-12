import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetDayOrdersQueryDto } from './dto/get-day-orders-query.dto';
import { GetKitchenOrdersQueryDto } from './dto/get-kitchen-orders-query.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.ordersService.create(dto, user);
    // 200 for an idempotency-key hit (order already existed), 201 for a new order
    res.status(result.duplicate ? 200 : 201);
    return { order_id: result.order_id, daily_number: result.daily_number };
  }

  @Get()
  getDayOrders(
    @Query() query: GetDayOrdersQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.getDayOrders(query.branchId, query.date, user);
  }

  @Get('kitchen')
  getPendingKitchenOrders(
    @Query() query: GetKitchenOrdersQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.getPendingKitchenOrders(query.branchId, user);
  }

  // Sin @Roles: mesero necesita poder llamarlo, mismo criterio que create().
  @Post(':id/items')
  addItemsToOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOrderItemsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.addItemsToOrder(id, dto, user);
  }

  @Post(':id/ready')
  @UseGuards(RolesGuard)
  @Roles('admin', 'cajero', 'cocinero')
  markReady(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.markReady(id, user);
  }

  @Post(':id/pay')
  @UseGuards(RolesGuard)
  @Roles('admin', 'cajero')
  payOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayOrderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.payOrder(id, dto, user);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('admin', 'cajero', 'cocinero')
  cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.cancelOrder(id, dto, user);
  }
}
