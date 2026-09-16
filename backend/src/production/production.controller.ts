import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { ProductionService } from './production.service';
import { LogIngredientUsageDto } from './dto/log-ingredient-usage.dto';
import { LogOutputDto } from './dto/log-output.dto';
import { ListProductionLogQueryDto } from './dto/list-production-log-query.dto';

// admin can also operate here (same criteria as /kitchen, /mesero) so the
// flow can be tested without needing a dedicated produccion user.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('produccion', 'admin')
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('ingredient-usage')
  logIngredientUsage(@Body() dto: LogIngredientUsageDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productionService.logIngredientUsage(dto, user);
  }

  @Get('ingredient-usage')
  listIngredientUsage(@Query() query: ListProductionLogQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productionService.listIngredientUsage(query, user);
  }

  @Patch('ingredient-usage/:id')
  updateIngredientUsage(
    @Param('id') id: string,
    @Body() dto: LogIngredientUsageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productionService.updateIngredientUsage(id, dto, user);
  }

  @Delete('ingredient-usage/:id')
  deleteIngredientUsage(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productionService.deleteIngredientUsage(id, user);
  }

  @Post('output')
  logOutput(@Body() dto: LogOutputDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productionService.logOutput(dto, user);
  }

  @Get('output')
  listOutput(@Query() query: ListProductionLogQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productionService.listOutput(query, user);
  }

  @Patch('output/:id')
  updateOutput(@Param('id') id: string, @Body() dto: LogOutputDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productionService.updateOutput(id, dto, user);
  }

  @Delete('output/:id')
  deleteOutput(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productionService.deleteOutput(id, user);
  }
}
