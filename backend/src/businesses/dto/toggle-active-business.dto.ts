import { IsBoolean } from 'class-validator';

export class ToggleActiveBusinessDto {
  @IsBoolean()
  is_active!: boolean;
}
