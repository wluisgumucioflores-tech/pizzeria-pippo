import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Hard ceilings for an UNAUTHENTICATED write endpoint. They are not business
// rules, they are abuse limits: a real customer never hits them, and a script
// gets a 400 instead of a giant row. Per-IP rate limiting is separate (the
// throttler on the controller).
export const MAX_ITEMS_PER_PUBLIC_ORDER = 30;
export const MAX_QTY_PER_LINE = 50;

// Digits with an optional leading +, same shape the admin's own number uses.
const CUSTOMER_PHONE = /^\+?[0-9]{7,15}$/;

export class PublicOrderItemDto {
  @IsUUID()
  variant_id!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QTY_PER_LINE)
  qty!: number;
}

export class CreatePublicOrderDto {
  @IsUUID()
  branch_id!: string;

  @IsString()
  @Length(2, 60)
  customer_name!: string;

  @IsString()
  @Matches(CUSTOMER_PHONE, {
    message: 'El teléfono debe tener entre 7 y 15 dígitos',
  })
  customer_phone!: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS_PER_PUBLIC_ORDER)
  @ValidateNested({ each: true })
  @Type(() => PublicOrderItemDto)
  items!: PublicOrderItemDto[];

  // No `total` field on purpose: the server computes it from branch_prices and
  // never compares against a client-supplied number. The POS does send a total
  // (OrdersService cross-checks it to detect a stale catalog), but there the
  // client is authenticated staff — here it would just be an input to validate
  // for no gain.
}
