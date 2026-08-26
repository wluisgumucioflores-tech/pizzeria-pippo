import { IsString, MinLength } from 'class-validator';

export class CreateMcpKeyDto {
  @IsString()
  @MinLength(3)
  name!: string;
}
