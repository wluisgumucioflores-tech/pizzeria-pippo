export type KitchenDisplayMode = "full" | "pizzas_only";

export interface AppSettings {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_enabled: boolean;
  kitchen_stage_warning_minutes: number;
  kitchen_late_threshold_minutes: number;
  kitchen_display_mode: KitchenDisplayMode;
  kitchen_color_fresh: string;
  kitchen_color_warning: string;
  kitchen_color_late: string;
  printer_paper_width: number;
  printer_business_name: string;
  use_stock: boolean;
}
