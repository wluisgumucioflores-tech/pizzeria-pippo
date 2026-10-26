import type { OnlineMenuMode } from '@pippo/shared';

export interface SettingsResult {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_enabled: boolean;
  chat_ia_enabled: boolean;
  kitchen_stage_warning_minutes: number;
  kitchen_late_threshold_minutes: number;
  kitchen_visible_category_ids: string[];
  kitchen_color_fresh: string;
  kitchen_color_warning: string;
  kitchen_color_late: string;
  printer_paper_width: number;
  printer_business_name: string;
  use_stock: boolean;
  pos_enable_table_number: boolean;
  stock_deduct_resale: boolean;
  stock_deduct_insumos: boolean;
  stock_deduct_made_unit: boolean;
  online_orders_whatsapp: string;
  online_orders_expire_minutes: number;
  online_menu_mode: OnlineMenuMode;
  online_menu_category_ids: string[];
  online_menu_product_ids: string[];
}
