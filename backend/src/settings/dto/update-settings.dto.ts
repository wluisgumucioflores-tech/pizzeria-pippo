import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAX_ONLINE_ORDERS_EXPIRE_MINUTES,
  MIN_ONLINE_ORDERS_EXPIRE_MINUTES,
  ONLINE_MENU_MODES,
  type OnlineMenuMode,
} from '@pippo/shared';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Digits, with an optional leading +. The country code matters (wa.me needs
// the full international number), but which country is the business's call —
// so the format is checked, not the prefix. Empty is allowed on purpose: the
// frontend round-trips the WHOLE settings object on every tab's save, so a
// business that never configured online orders must still be able to save
// the printer or kitchen tab.
const WHATSAPP_NUMBER = /^$|^\+?[0-9]{8,15}$/;

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
  @IsBoolean()
  chat_ia_enabled?: boolean;

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

  @IsOptional()
  @IsBoolean()
  stock_deduct_resale?: boolean;

  @IsOptional()
  @IsBoolean()
  stock_deduct_insumos?: boolean;

  @IsOptional()
  @IsBoolean()
  stock_deduct_made_unit?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(WHATSAPP_NUMBER, {
    message:
      'online_orders_whatsapp debe ser un número con código de país (ej. +59170000000)',
  })
  online_orders_whatsapp?: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_ONLINE_ORDERS_EXPIRE_MINUTES)
  @Max(MAX_ONLINE_ORDERS_EXPIRE_MINUTES)
  online_orders_expire_minutes?: number;

  @IsOptional()
  @IsIn(ONLINE_MENU_MODES)
  online_menu_mode?: OnlineMenuMode;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  online_menu_category_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  online_menu_product_ids?: string[];
}
