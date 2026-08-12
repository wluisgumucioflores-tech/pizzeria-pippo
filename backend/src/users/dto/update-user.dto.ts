import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  full_name!: string;

  @IsIn(['admin', 'cajero', 'cocinero', 'mesero'])
  role!: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  // Optional: lets an admin reset a user's password.
  // Without this there'd be no way to recover access for a user who
  // forgot their password, since there's no "forgot my password" flow.
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
