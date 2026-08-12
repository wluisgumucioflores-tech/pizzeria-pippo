import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderItemInputDto } from './order-item-input.dto';

// Agregar items a un pedido que ya se mandó a cocina y sigue pendiente
// (docs/features/mesero-y-mejoras-pos/) — "total" es la suma de solo los
// items nuevos, no el total acumulado del pedido.
export class AddOrderItemsDto {
  @IsNumber()
  @Min(0)
  total!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];
}
