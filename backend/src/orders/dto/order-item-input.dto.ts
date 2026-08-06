import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { OrderItemFlavorInputDto } from './order-item-flavor-input.dto';

export class OrderItemInputDto {
  @IsUUID()
  variant_id!: string;

  @IsInt()
  @IsPositive()
  qty!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemFlavorInputDto)
  flavors?: OrderItemFlavorInputDto[] | null;

  // Ties this line to the specific PERCENTAGE promo it was added from via
  // the POS "Promociones" tab — see promotions-engine.ts's applyPercentage.
  @IsOptional()
  @IsString()
  promo_id?: string | null;
}
