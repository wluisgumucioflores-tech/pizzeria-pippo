import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
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
}
