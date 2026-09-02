export interface AiChatUsageToday {
  plan_name: string | null;
  limit: number | null;
  used: number;
}

export interface AiChatUsageDay {
  date: string;
  messages: number;
  input_tokens: number;
  output_tokens: number;
}

export interface AiChatUsageSummary {
  plan_name: string | null;
  daily_limit: number | null;
  messages_today: number;
  lifetime_messages: number;
  lifetime_input_tokens: number;
  lifetime_output_tokens: number;
  daily_breakdown: AiChatUsageDay[];
}
