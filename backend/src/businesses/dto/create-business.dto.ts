import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
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
}
