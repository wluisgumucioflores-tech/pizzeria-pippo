import { IsNumber, IsUUID, Min } from 'class-validator';

export class OpenSessionDto {
  @IsUUID()
  branch_id: string;

  @IsNumber()
  @Min(0)
  opening_amount: number;
}
