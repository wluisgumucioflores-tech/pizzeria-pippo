import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
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

  // 'online' is the sale a confirmed QR request becomes (see
  // docs/features/pedidos-online-qr/). Unrelated to payment_method 'online'
  // above — different column, same word, same situation 'pedidos_ya' already
  // had. Only OnlineOrdersService produces it; nothing in the POS does.
  @IsIn(['dine_in', 'takeaway', 'delivery', 'pedidos_ya', 'online'])
  order_type!: 'dine_in' | 'takeaway' | 'delivery' | 'pedidos_ya' | 'online';

  @IsOptional()
  @IsString()
  @Length(0, 50)
  table_number?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  waiter_name?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @Length(8, 64)
  idempotency_key?: string | null;

  // Ticket number the device already printed from a range it reserved while
  // online (offline sales). Only honoured when the business has the
  // offlineSales module on AND the number falls inside a range actually
  // reserved for this branch and day — see OrdersService.assertReservedNumber.
  @IsOptional()
  @IsInt()
  @Min(1)
  daily_number?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];
}
