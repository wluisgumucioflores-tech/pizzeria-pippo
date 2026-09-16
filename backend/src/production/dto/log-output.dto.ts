import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class LogOutputDto {
  @IsUUID()
  variant_id: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
