import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { CreateAdminInputDto } from './create-admin-input.dto';

export class CreateBusinessDto {
  @IsString()
  name!: string;

  @ValidateNested()
  @Type(() => CreateAdminInputDto)
  admin!: CreateAdminInputDto;
}
