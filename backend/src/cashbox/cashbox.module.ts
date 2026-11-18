import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { CashboxController } from './cashbox.controller';
import { CashboxService } from './cashbox.service';

// ScheduleModule.forRoot() habilita el @Cron de auto-cierre en
// CashboxService — mismo patrón que OnlineOrdersModule (ver su comentario),
// seguro de registrar en más de un módulo porque es `global: true` sin
// opciones propias.
@Module({
  imports: [AuthModule, ScheduleModule.forRoot()],
  controllers: [CashboxController],
  providers: [CashboxService],
})
export class CashboxModule {}
