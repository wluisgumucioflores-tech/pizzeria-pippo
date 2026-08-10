import type { AIProvider } from "../types";

export const SETTINGS_KEYS = [
  "telegram_ai_enabled",
  "ai_provider",
  "anthropic_api_key",
  "openai_compatible_api_key",
  "openai_compatible_base_url",
  "telegram_ai_model",
  "telegram_plan_basic_limit",
  "telegram_plan_pro_limit",
];

export const QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export const MODEL_VALUES: Record<AIProvider, string[]> = {
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"],
  openai_compatible: ["qwen-plus", "qwen-turbo", "qwen-max", "gpt-4o-mini", "gpt-4o"],
};

type Translate = (key: string) => string;

export function getModels(t: Translate): Record<AIProvider, { value: string; label: string }[]> {
  return {
    anthropic: [
      { value: "claude-haiku-4-5-20251001", label: t("models.haiku") },
      { value: "claude-sonnet-4-6", label: t("models.sonnet") },
    ],
    openai_compatible: [
      { value: "qwen-plus", label: t("models.qwenPlus") },
      { value: "qwen-turbo", label: t("models.qwenTurbo") },
      { value: "qwen-max", label: t("models.qwenMax") },
      { value: "gpt-4o-mini", label: t("models.gpt4oMini") },
      { value: "gpt-4o", label: t("models.gpt4o") },
    ],
  };
}
