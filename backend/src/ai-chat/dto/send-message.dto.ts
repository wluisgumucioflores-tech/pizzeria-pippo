import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  content!: string;
}

export class SendMessageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsOptional()
  @IsString()
  locale?: string;

  // Branch the admin picked in the widget's selector (only shown when the
  // business has more than one). Ignored for callers with a fixed branch_id
  // (cajero/mesero) — AiChatProxyService always trusts their own JWT branch
  // over this. Omitted/undefined = "all branches".
  @IsOptional()
  @IsUUID()
  branch_id?: string;
}
