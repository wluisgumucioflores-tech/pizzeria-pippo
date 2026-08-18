import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { VariantTypesService } from './variant-types.service';
import { ListVariantTypesQueryDto } from './dto/list-variant-types-query.dto';
import { CreateVariantTypeDto } from './dto/create-variant-type.dto';
import { UpdateVariantTypeDto } from './dto/update-variant-type.dto';
import { PatchVariantTypeDto } from './dto/patch-variant-type.dto';

// Real RLS (confirmed against the DB): SELECT is public for any authenticated user
// (variant_types_select_all), INSERT/UPDATE/DELETE admin-only.
@UseGuards(JwtAuthGuard)
@ApiTags('variant-types')
@Controller('variant-types')
export class VariantTypesController {
  constructor(private readonly variantTypesService: VariantTypesService) {}

  @Get()
  list(@Query() query: ListVariantTypesQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.variantTypesService.list(query, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateVariantTypeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.variantTypesService.create(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVariantTypeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.variantTypesService.update(id, dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: PatchVariantTypeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.variantTypesService.setActive(id, dto.is_active, user);
  }
}
