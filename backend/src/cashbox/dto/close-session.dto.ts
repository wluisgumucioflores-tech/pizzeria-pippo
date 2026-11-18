import { IsNumber, Min } from 'class-validator';

export class CloseSessionDto {
  @IsNumber()
  @Min(0)
  counted_amount: number;
}
