import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { PAYMENT_PROVIDERS } from '@pippo/shared';
import { OrderItemInputDto } from './order-item-input.dto';
import { OrderPaymentInputDto } from './order-payment-input.dto';

export class CreateOrderDto {
  @IsUUID()
  branch_id!: string;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsOptional()
  @IsIn(['efectivo', 'qr', 'online', 'mixto'])
  payment_method?: 'efectivo' | 'qr' | 'online' | 'mixto' | null;

  @IsOptional()
  @IsIn(Object.keys(PAYMENT_PROVIDERS))
  payment_provider?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => OrderPaymentInputDto)
  payments?: OrderPaymentInputDto[] | null;

  @IsIn(['dine_in', 'takeaway'])
  order_type!: 'dine_in' | 'takeaway';

  @IsOptional()
  @IsString()
  @Length(0, 300)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @Length(8, 64)
  idempotency_key?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];
}
