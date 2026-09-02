import { IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import type { EnabledModules } from '@pippo/shared';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  enabled_modules?: Partial<EnabledModules>;

  @IsOptional()
  @IsUUID()
  ai_chat_plan_id?: string;
}
