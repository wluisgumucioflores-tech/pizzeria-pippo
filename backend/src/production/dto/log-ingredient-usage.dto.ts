import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class LogIngredientUsageDto {
  @IsUUID()
  ingredient_id: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
