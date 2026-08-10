import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateAdminInputDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  full_name!: string;
}
