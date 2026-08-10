import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ReportsModule } from './reports/reports.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { PromotionsModule } from './promotions/promotions.module';
import { BranchesModule } from './branches/branches.module';
import { VariantTypesModule } from './variant-types/variant-types.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { DevicesModule } from './devices/devices.module';
import { PaymentValidationModule } from './payment-validation/payment-validation.module';
import { TelegramModule } from './telegram/telegram.module';
import { PublicMenuModule } from './public-menu/public-menu.module';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { BusinessesModule } from './businesses/businesses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ReportsModule,
    IngredientsModule,
    ProductsModule,
    StockModule,
    WarehouseModule,
    PromotionsModule,
    BranchesModule,
    VariantTypesModule,
    UsersModule,
    SettingsModule,
    NotificationsModule,
    OrdersModule,
    StorageModule,
    DevicesModule,
    PaymentValidationModule,
    TelegramModule,
    PublicMenuModule,
    EmployeesModule,
    AttendanceModule,
    BusinessesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
