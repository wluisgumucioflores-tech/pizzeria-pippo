import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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
  kitchen_stage_warning_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  kitchen_late_threshold_minutes?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  kitchen_visible_category_ids?: string[];

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'kitchen_color_fresh debe ser un color hex (#rrggbb)' })
  kitchen_color_fresh?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'kitchen_color_warning debe ser un color hex (#rrggbb)' })
  kitchen_color_warning?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'kitchen_color_late debe ser un color hex (#rrggbb)' })
  kitchen_color_late?: string;

  @IsOptional()
  @IsIn([58, 80])
  printer_paper_width?: number;

  @IsOptional()
  @IsString()
  printer_business_name?: string;

  @IsOptional()
  @IsBoolean()
  use_stock?: boolean;

  @IsOptional()
  @IsBoolean()
  pos_enable_table_number?: boolean;
}
