import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiChatPlansController } from './ai-chat-plans.controller';
import { AiChatPlansService } from './ai-chat-plans.service';

@Module({
  imports: [AuthModule],
  controllers: [AiChatPlansController],
  providers: [AiChatPlansService],
  exports: [AiChatPlansService],
})
export class AiChatPlansModule {}
