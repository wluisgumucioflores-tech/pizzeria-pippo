import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
