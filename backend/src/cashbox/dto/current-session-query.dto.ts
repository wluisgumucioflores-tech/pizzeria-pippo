import { IsUUID } from 'class-validator';

export class CurrentSessionQueryDto {
  @IsUUID()
  branchId: string;
}
