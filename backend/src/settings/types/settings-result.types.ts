import type { KitchenDisplayMode } from '../dto/update-settings.dto';

export interface SettingsResult {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_enabled: boolean;
  kitchen_late_threshold_minutes: number;
  kitchen_display_mode: KitchenDisplayMode;
  printer_paper_width: number;
  printer_business_name: string;
  use_stock: boolean;
}
