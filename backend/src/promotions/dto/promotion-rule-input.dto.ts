import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

const CATEGORIES = ['pizza', 'bebida', 'otro'] as const;
const VARIANT_SIZES = [
  'Personal',
  'Mediana',
  'Familiar',
  'Popular',
  'Pequeña',
  'Mini',
  'Grande',
  'Garrafita',
  'Litro',
  'Litro y medio',
  'Juguete',
] as const;

export class PromotionRuleInputDto {
  @IsOptional()
  @IsUUID()
  variant_id?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  buy_qty?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  get_qty?: number | null;

  @IsOptional()
  @IsNumber()
  discount_percent?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  combo_price?: number | null;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number] | null;

  @IsOptional()
  @IsIn(VARIANT_SIZES)
  variant_size?: (typeof VARIANT_SIZES)[number] | null;
}
