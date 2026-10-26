import { IsUUID } from 'class-validator';

export class ListOnlineOrdersQueryDto {
  @IsUUID()
  branchId!: string;
}
