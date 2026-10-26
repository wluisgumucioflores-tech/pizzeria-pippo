import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { OrdersModule } from '../orders/orders.module';
import { PublicOnlineOrdersController } from './public-online-orders.controller';
import { PublicOnlineOrdersService } from './public-online-orders.service';
import { OnlineOrdersController } from './online-orders.controller';
import { OnlineOrdersService } from './online-orders.service';

// Pedidos online por QR — see docs/features/pedidos-online-qr/.
//
// Two controllers on purpose, with opposite auth postures:
//   PublicOnlineOrdersController  — NO guard, rate limited, customer facing
//   OnlineOrdersController        — JwtAuthGuard + @Roles('admin','cajero')
// They share the service layer and lib/, which is why they live in one module
// instead of two.
//
// ThrottlerModule is registered HERE rather than globally in AppModule: the
// rate limiting exists for the unauthenticated public endpoints, and putting
// it app-wide would quietly start throttling the POS and the kitchen screen,
// which legitimately burst (a busy cashier, a reconnecting socket).
// Per-handler limits live on the controller via @Throttle; this default is
// just the floor for anything that forgets one.
//
// ScheduleModule.forRoot() enables the @Cron in OnlineOrdersService. It is the
// first scheduled job in the codebase, so it is registered here rather than in
// AppModule — nothing else needs it yet.
@Module({
  imports: [
    AuthModule,
    SettingsModule,
    OrdersModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ limit: 30, ttl: 60_000 }]),
  ],
  controllers: [PublicOnlineOrdersController, OnlineOrdersController],
  providers: [PublicOnlineOrdersService, OnlineOrdersService],
})
export class OnlineOrdersModule {}
