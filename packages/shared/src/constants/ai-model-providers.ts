// Single source of truth for the AI model "provider" field (ai_models.provider).
// This is a PROTOCOL, not a brand — DeepSeek, Qwen/DashScope, Groq, Together.ai,
// etc. all speak the OpenAI chat-completions protocol, so they all map to
// "openai_compatible" + their own base_url, not a value of their own. Adding
// a new brand almost never means adding a new value here — only a genuinely
// new wire protocol would (see ChatModelFactory.java on the Spring side,
// which switches on these same 4 strings).
export const AI_MODEL_PROVIDERS = {
  ollama: { label: "Ollama (local)" },
  anthropic: { label: "Anthropic (Claude)" },
  openai: { label: "OpenAI" },
  openai_compatible: {
    label: "Compatible con OpenAI (DeepSeek, Qwen/DashScope, Groq, etc.)",
  },
} as const;

export type AiModelProvider = keyof typeof AI_MODEL_PROVIDERS;
