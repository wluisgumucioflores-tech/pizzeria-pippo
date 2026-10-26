// JwtStrategy refuses to construct without this (auth/jwt.strategy.ts), and
// this test builds the REAL module graph — AuthModule and OrdersModule
// included — so it has to be set before anything is imported. The value is
// irrelevant: nothing here signs or verifies a token.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-wiring';

import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SchedulerRegistry } from '@nestjs/schedule';
import { OnlineOrdersModule } from './online-orders.module';
import { PublicOnlineOrdersController } from './public-online-orders.controller';
import { PublicOnlineOrdersService } from './public-online-orders.service';
import { OnlineOrdersController } from './online-orders.controller';
import { OnlineOrdersService } from './online-orders.service';
import { PrismaService } from '../prisma/prisma.service';

// Stands in for the real PrismaModule, which is @Global() and imported once
// in AppModule — that's why OnlineOrdersModule doesn't (and shouldn't) import
// it, same as OrdersModule and PublicMenuModule. An isolated test has no
// AppModule, so the global provider has to come from somewhere.
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class StubPrismaModule {}

// This module's whole job is wiring, and three of its pieces fail only at
// boot, never at tsc: a controller with NO auth guard next to one WITH it, a
// throttler whose guard can't be built without its options, and a cron that
// needs ScheduleModule.forRoot(). Compiling the graph here means a broken
// import is caught by `npm test` instead of by `npm run dev`.
describe('OnlineOrdersModule', () => {
  it('resuelve los dos controllers, sus services, el throttler y el scheduler', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StubPrismaModule, OnlineOrdersModule],
    }).compile();

    // Public (sin guard) y gestión (con JwtAuthGuard + RolesGuard) conviven.
    expect(moduleRef.get(PublicOnlineOrdersController)).toBeDefined();
    expect(moduleRef.get(PublicOnlineOrdersService)).toBeDefined();
    expect(moduleRef.get(OnlineOrdersController)).toBeDefined();
    expect(moduleRef.get(OnlineOrdersService)).toBeDefined();

    // Falla si se saca ThrottlerModule.forRoot: el guard no se puede construir
    // sin sus opciones y su storage.
    expect(moduleRef.get(ThrottlerGuard, { strict: false })).toBeDefined();
    // Falla si se saca ScheduleModule.forRoot: el @Cron de expiración no corre.
    expect(moduleRef.get(SchedulerRegistry, { strict: false })).toBeDefined();

    await moduleRef.close();
  });
});
