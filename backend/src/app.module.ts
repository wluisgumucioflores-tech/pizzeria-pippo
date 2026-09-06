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
import { TelegramChatIaModule } from './telegram-chat-ia/telegram-chat-ia.module';
import { PublicMenuModule } from './public-menu/public-menu.module';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { BusinessesModule } from './businesses/businesses.module';
import { CategoriesModule } from './categories/categories.module';
import { McpModule } from './mcp/mcp.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { AiChatPlansModule } from './ai-chat-plans/ai-chat-plans.module';
import { AiChatUsageModule } from './ai-chat-usage/ai-chat-usage.module';

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
    TelegramChatIaModule,
    PublicMenuModule,
    EmployeesModule,
    AttendanceModule,
    BusinessesModule,
    CategoriesModule,
    McpModule,
    AiChatModule,
    AiChatPlansModule,
    AiChatUsageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
