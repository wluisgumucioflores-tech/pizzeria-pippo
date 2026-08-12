import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { PAYMENT_PROVIDERS } from '@pippo/shared';
import { OrderPaymentInputDto } from './order-payment-input.dto';

export class PayOrderDto {
  @IsIn(['efectivo', 'qr', 'online', 'mixto'])
  payment_method!: 'efectivo' | 'qr' | 'online' | 'mixto';

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
}
