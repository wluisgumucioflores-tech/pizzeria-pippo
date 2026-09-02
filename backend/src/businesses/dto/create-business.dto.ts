import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { CreateAdminInputDto } from './create-admin-input.dto';
import type { EnabledModules } from '@pippo/shared';

export class CreateBusinessDto {
  @IsString()
  name!: string;

  @ValidateNested()
  @Type(() => CreateAdminInputDto)
  admin!: CreateAdminInputDto;

  @IsOptional()
  @IsObject()
  enabled_modules?: Partial<EnabledModules>;

  // Si se omite, se asigna el plan marcado como default (ver AiChatPlan.isDefault).
  @IsOptional()
  @IsUUID()
  ai_chat_plan_id?: string;
}
