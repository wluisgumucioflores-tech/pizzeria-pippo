import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { OrderItemFlavorInputDto } from './order-item-flavor-input.dto';
import { OrderItemExtraInputDto } from './order-item-extra-input.dto';

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

  // Groundwork únicamente (Fase 0 del roadmap de docs/meet/new-features.md) —
  // todavía no hay UI que cree extras; el pricing/promociones no los integra
  // hasta la fase donde se construye esa UI (Mesero/POS).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemExtraInputDto)
  extras?: OrderItemExtraInputDto[] | null;

  // Ties this line to the specific PERCENTAGE promo it was added from via
  // the POS "Promociones" tab — see promotions-engine.ts's applyPercentage.
  @IsOptional()
  @IsString()
  promo_id?: string | null;

  // Fase 3 (docs/features/mesero-y-mejoras-pos/) — override manual del precio
  // de venta, solo honrado para cajero/admin (ver orders.service.ts) y solo
  // sobre items sin promo_id/flavors (mismo criterio que extras).
  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;
}
