import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  full_name!: string;

  @IsIn(['admin', 'cajero', 'cocinero', 'mesero'])
  role!: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;
}
