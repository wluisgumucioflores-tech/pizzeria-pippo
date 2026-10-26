import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersGateway } from './realtime/orders.gateway';

@Module({
  imports: [AuthModule, PromotionsModule, NotificationsModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  // OrdersService is exported for OnlineOrdersModule: confirming a QR request
  // creates the sale through this same service instead of reimplementing one.
  exports: [OrdersGateway, OrdersService],
})
export class OrdersModule {}
