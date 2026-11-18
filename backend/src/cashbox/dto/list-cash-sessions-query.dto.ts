import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ListCashSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
