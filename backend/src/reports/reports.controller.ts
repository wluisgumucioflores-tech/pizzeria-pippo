import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { CashierReportQueryDto } from './dto/cashier-report-query.dto';
import { OrdersReportQueryDto } from './dto/orders-report-query.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  getSales(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getSales(query, user);
  }

  @Get('daily')
  getDaily(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getDaily(query, user);
  }

  @Get('top-products')
  getTopProducts(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getTopProducts(query, user);
  }

  @Get('cashiers')
  getCashiers(
    @Query() query: CashierReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getCashiers(query, user);
  }

  @Get('orders')
  getOrders(
    @Query() query: OrdersReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getOrders(query, user);
  }
}
