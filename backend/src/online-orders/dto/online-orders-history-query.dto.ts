import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ONLINE_ORDER_STATUSES } from '../lib/online-order.lib';

// A business with a busy QR could accumulate thousands of rows; an unbounded
// list would ship all of them to a phone browser.
//
// Declared ABOVE the class: decorators are evaluated when the class is
// defined, so referencing these from below would throw at module load.
export const MAX_HISTORY_PAGE_SIZE = 100;
export const DEFAULT_HISTORY_PAGE_SIZE = 50;

// History query for the ADMIN section. Every filter is optional: with none, it
// answers "every online request this business ever got, newest first".
//
// Separate from ListOnlineOrdersQueryDto on purpose. That one is the cashier's
// queue and ALWAYS means "pending and still actionable" — making that
// conditional on query params would let a bad call put rows in front of a
// cashier that they cannot actually confirm.
export class OnlineOrdersHistoryQueryDto {
  /** Omitted = every branch of the business. */
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(ONLINE_ORDER_STATUSES)
  status?: string;

  /** Inclusive lower bound on created_at. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound on created_at. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_HISTORY_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
