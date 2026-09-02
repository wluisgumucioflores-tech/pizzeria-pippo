import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PasswordModule } from '../auth/password/password.module';
import { CategoriesModule } from '../categories/categories.module';
import { AiChatUsageModule } from '../ai-chat-usage/ai-chat-usage.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [AuthModule, PasswordModule, CategoriesModule, AiChatUsageModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
