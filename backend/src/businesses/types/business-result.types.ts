import type { EnabledModules } from '@pippo/shared';

export interface BusinessAiChatPlanResult {
  id: string;
  name: string;
  messages_per_day: number | null;
}

export interface BusinessResult {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  enabled_modules: EnabledModules;
  ai_chat_plan: BusinessAiChatPlanResult | null;
}
