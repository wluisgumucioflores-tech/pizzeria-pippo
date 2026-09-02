import type { EnabledModules } from "../constants/business-modules";

export interface BusinessAiChatPlan {
  id: string;
  name: string;
  messages_per_day: number | null;
}

export interface Business {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  enabled_modules: EnabledModules;
  // null when the business never had a Chat IA plan assigned — aiChat is
  // an opt-in feature flag (enabled_modules.aiChat), not every business needs one.
  ai_chat_plan: BusinessAiChatPlan | null;
}
