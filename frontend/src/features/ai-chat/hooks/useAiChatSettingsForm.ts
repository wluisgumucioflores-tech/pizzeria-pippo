"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { useTranslations } from "next-intl";
import { getChatSettings, saveChatSettings, generateInternalKey } from "../services/aiChat.service";
import { QWEN_BASE_URL, MODEL_VALUES } from "../constants/ai-chat-settings.constants";
import type { AIProvider, AiChatSettings } from "../types";

export function useAiChatSettingsForm() {
  const t = useTranslations("settings.aiChat");
  const [settings, setSettings] = useState<AiChatSettings>({
    ai_chat_provider: "anthropic",
    ai_chat_anthropic_api_key: "",
    ai_chat_openai_compatible_api_key: "",
    ai_chat_openai_compatible_base_url: QWEN_BASE_URL,
    ai_chat_model: "claude-haiku-4-5-20251001",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await getChatSettings();
      setSettings({
        ai_chat_provider: (config["ai_chat_provider"] as AIProvider) || "anthropic",
        ai_chat_anthropic_api_key: config["ai_chat_anthropic_api_key"] ? "***configured***" : "",
        ai_chat_openai_compatible_api_key: config["ai_chat_openai_compatible_api_key"] ? "***configured***" : "",
        ai_chat_openai_compatible_base_url: config["ai_chat_openai_compatible_base_url"] || QWEN_BASE_URL,
        ai_chat_model: config["ai_chat_model"] || "claude-haiku-4-5-20251001",
      });
    } catch {
      message.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleChange = <K extends keyof AiChatSettings>(field: K, value: AiChatSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "ai_chat_provider") {
        const provider = value as AIProvider;
        next.ai_chat_model = MODEL_VALUES[provider][0];
        if (provider === "openai_compatible" && !next.ai_chat_openai_compatible_base_url) {
          next.ai_chat_openai_compatible_base_url = QWEN_BASE_URL;
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { key: string; value: string }[] = [
        { key: "ai_chat_provider", value: settings.ai_chat_provider },
        { key: "ai_chat_model", value: settings.ai_chat_model },
        { key: "ai_chat_openai_compatible_base_url", value: settings.ai_chat_openai_compatible_base_url },
      ];
      if (settings.ai_chat_anthropic_api_key && settings.ai_chat_anthropic_api_key !== "***configured***") {
        updates.push({ key: "ai_chat_anthropic_api_key", value: settings.ai_chat_anthropic_api_key });
      }
      if (settings.ai_chat_openai_compatible_api_key && settings.ai_chat_openai_compatible_api_key !== "***configured***") {
        updates.push({ key: "ai_chat_openai_compatible_api_key", value: settings.ai_chat_openai_compatible_api_key });
      }

      await saveChatSettings(updates);
      message.success(t("saved"));
      await load();
    } catch {
      message.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      setNewApiKey(await generateInternalKey());
    } catch {
      message.error(t("generateKeyError"));
    } finally {
      setGeneratingKey(false);
    }
  };

  const closeApiKeyModal = () => setNewApiKey(null);

  return {
    settings, loading, saving, generatingKey, newApiKey,
    handleChange, handleSave, handleGenerateKey, closeApiKeyModal,
  };
}
