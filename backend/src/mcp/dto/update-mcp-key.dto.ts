import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMcpKeyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
