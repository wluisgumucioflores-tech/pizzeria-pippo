import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ProduccionStockGuard } from '../common/guards/produccion-stock.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { WarehouseService } from './warehouse.service';
import { WarehouseProductService } from './warehouse-product.service';
import { ListWarehouseStockQueryDto } from './dto/list-warehouse-stock-query.dto';
import { ListWarehouseMovementsQueryDto } from './dto/list-warehouse-movements-query.dto';
import { PurchaseWarehouseStockDto } from './dto/purchase-warehouse-stock.dto';
import { AdjustWarehouseStockDto } from './dto/adjust-warehouse-stock.dto';
import { TransferWarehouseStockDto } from './dto/transfer-warehouse-stock.dto';
import { UpdateWarehouseMinQuantityDto } from './dto/update-warehouse-min-quantity.dto';
import { ListWarehouseProductMovementsQueryDto } from './dto/list-warehouse-product-movements-query.dto';
import { PurchaseWarehouseProductStockDto } from './dto/purchase-warehouse-product-stock.dto';
import { AdjustWarehouseProductStockDto } from './dto/adjust-warehouse-product-stock.dto';
import { TransferWarehouseProductStockDto } from './dto/transfer-warehouse-product-stock.dto';

// DB-level RLS on these tables (warehouse_stock_admin_all, etc.) is stale
// and effectively inert: Prisma connects as the postgres superuser, which
// bypasses RLS entirely (see CLAUDE.md "Autenticación y Sesiones" — Supabase
// Auth isn't used anymore). The @Roles(...)/guards below are what actually
// enforce access now.
// Central ingredient warehouse (warehouse_stock/warehouse_movements): now
// open to 'admin' and 'produccion' (gated per-business by produccionStock,
// see ProduccionStockGuard) — same read/purchase/adjust/transfer access
// admin already had.
// Resale/finished-goods warehouse (warehouse_product_stock/warehouse_product_movements):
// the product-* endpoints below enforce @Roles('admin', 'produccion') at the
// app level independent of produccionStock — jefe de producción needs them
// for Fase 10 (self-service transfer to a branch) regardless of that flag.
@UseGuards(JwtAuthGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly warehouseProductService: WarehouseProductService,
  ) {}

  // @Roles('admin', 'produccion') + ProduccionStockGuard: gives jefe de
  // producción the same read/purchase/adjust/transfer access admin already
  // has here, gated per-business by the produccionStock module (separate
  // from the produccion module itself, which only controls the role).
  @UseGuards(RolesGuard, ProduccionStockGuard)
  @Roles('admin', 'produccion')
  @Get('stock')
  listStock(@Query() query: ListWarehouseStockQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseService.list(query, user);
  }

  // admin-only: produccion doesn't get the movements/history view (product
  // decision), so it stays out of @Roles here unlike the rest of this file.
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('movements')
  getMovements(@Query() query: ListWarehouseMovementsQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseService.getMovements(query, user);
  }

  @UseGuards(RolesGuard, ProduccionStockGuard)
  @Roles('admin', 'produccion')
  @Patch('stock/:id')
  updateMinQuantity(@Param('id') id: string, @Body() dto: UpdateWarehouseMinQuantityDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseService.updateMinQuantity(id, dto, user);
  }

  @UseGuards(RolesGuard, ProduccionStockGuard)
  @Roles('admin', 'produccion')
  @Delete('stock/:id')
  removeStock(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseService.remove(id, user);
  }

  @UseGuards(RolesGuard, ProduccionStockGuard)
  @Roles('admin', 'produccion')
  @Post('purchase')
  purchase(@Body() dto: PurchaseWarehouseStockDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseService.purchase(dto, user);
  }

  @UseGuards(RolesGuard, ProduccionStockGuard)
  @Roles('admin', 'produccion')
  @Post('adjust')
  adjust(@Body() dto: AdjustWarehouseStockDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseService.adjust(dto, user);
  }

  @UseGuards(RolesGuard, ProduccionStockGuard)
  @Roles('admin', 'produccion')
  @Post('transfer')
  transfer(@Body() dto: TransferWarehouseStockDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseService.transfer(dto, user);
  }

  // @Roles('admin', 'produccion') added for Fase 10 (docs/features/jefe-produccion/):
  // the jefe de producción needs to list warehouse balances and execute
  // transfers to a branch from their own panel. Before this, these 5
  // product-* endpoints had no role restriction at all — any authenticated
  // role (cajero/cocinero/mesero included) could already call them; this
  // closes that gap rather than opening a new one.
  @UseGuards(RolesGuard)
  @Roles('admin', 'produccion')
  @Get('product-stock')
  listProductStock(@Query('productType') productType: string | undefined, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseProductService.list(user, productType);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'produccion')
  @Get('product-movements')
  getProductMovements(@Query() query: ListWarehouseProductMovementsQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseProductService.getMovements(query, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'produccion')
  @Post('product-purchase')
  productPurchase(@Body() dto: PurchaseWarehouseProductStockDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseProductService.purchase(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'produccion')
  @Post('product-adjust')
  productAdjust(@Body() dto: AdjustWarehouseProductStockDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseProductService.adjust(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'produccion')
  @Post('product-transfer')
  productTransfer(@Body() dto: TransferWarehouseProductStockDto, @CurrentUser() user: CurrentUserPayload) {
    return this.warehouseProductService.transfer(dto, user);
  }
}
