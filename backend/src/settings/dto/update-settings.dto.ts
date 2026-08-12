import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  telegram_bot_token?: string;

  @IsOptional()
  @IsString()
  telegram_chat_id?: string;

  @IsOptional()
  @IsBoolean()
  telegram_enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  kitchen_late_threshold_minutes?: number;

  @IsOptional()
  @IsIn([58, 80])
  printer_paper_width?: number;

  @IsOptional()
  @IsString()
  printer_business_name?: string;

  @IsOptional()
  @IsBoolean()
  use_stock?: boolean;
}
