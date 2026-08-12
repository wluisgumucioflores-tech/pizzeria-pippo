import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class OrderItemExtraInputDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}
