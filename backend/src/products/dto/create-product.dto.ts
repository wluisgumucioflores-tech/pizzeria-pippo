import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { VariantInputDto } from './variant-input.dto';

const PRODUCT_TYPES = ['made', 'resale'] as const;

export class CreateProductDto {
  @IsString()
  name: string;

  @IsUUID()
  category_id: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  product_type?: (typeof PRODUCT_TYPES)[number];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants: VariantInputDto[];
}
