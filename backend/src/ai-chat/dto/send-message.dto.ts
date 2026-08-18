import {
  ArrayMinSize,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChatMessageDto } from './chat-message.dto';
import type { ChatLocale } from '../agents/build-system-prompt';

export class SendMessageDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  // Admin panel's current UI locale (next-intl) — the agent replies in this
  // language instead of assuming Spanish.
  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: ChatLocale;
}
