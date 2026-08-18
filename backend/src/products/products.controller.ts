import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { ProductsService } from './products.service';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PatchProductDto } from './dto/patch-product.dto';
import { PosCatalogQueryDto } from './dto/pos-catalog-query.dto';
import { UpsertBranchPriceDto } from './dto/upsert-branch-price.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.list(query, user);
  }

  // Before ':id' on purpose: otherwise ':id' would intercept this literal route.
  @Get('pos-catalog')
  getPosCatalog(@Query() query: PosCatalogQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.getPosCatalog(query.branchId, user);
  }

  // Also before ':id' for the same reason.
  @Get('all-variants')
  listAllVariants(@CurrentUser() user: CurrentUserPayload) {
    return this.productsService.listAllVariants(user);
  }

  @Get(':id')
  getDetail(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.getDetail(id, user);
  }

  @Get(':id/variants')
  getVariants(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.getVariantsWithDetails(id, user);
  }

  // The old Next.js route didn't restrict by role — fixed here, same
  // criteria as the rest of the writes in this controller.
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get(':id/branch-prices')
  getBranchPrices(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.getBranchPrices(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/branch-prices')
  upsertBranchPrice(@Body() dto: UpsertBranchPriceDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.upsertBranchPrice(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.create(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.duplicate(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.update(id, dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: PatchProductDto, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.setActive(id, dto.is_active, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.remove(id, user);
  }
}
