import { IsString, Length } from 'class-validator';

export class RejectOnlineOrderDto {
  // Required, and shown to the customer on their waiting screen — a rejection
  // with no reason leaves them refreshing a dead page with no idea why.
  @IsString()
  @Length(3, 200)
  reason!: string;
}
