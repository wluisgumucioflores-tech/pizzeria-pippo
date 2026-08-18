export type AIProvider = "anthropic" | "openai_compatible";

export interface AiChatSettings {
  ai_chat_provider: AIProvider;
  ai_chat_anthropic_api_key: string;
  ai_chat_openai_compatible_api_key: string;
  ai_chat_openai_compatible_base_url: string;
  ai_chat_model: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
