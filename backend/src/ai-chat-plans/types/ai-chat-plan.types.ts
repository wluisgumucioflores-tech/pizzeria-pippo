export interface AiChatPlanResult {
  id: string;
  name: string;
  messages_per_day: number | null;
  model_id: string | null;
  allowed_write_domains: string[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}
