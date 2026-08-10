"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { useTranslations } from "next-intl";
import { getBotSettings, saveBotSettings } from "../services/telegramBot.service";
import { SETTINGS_KEYS, QWEN_BASE_URL, MODEL_VALUES } from "../constants/bot-settings.constants";
import type { AIProvider, BotSettings } from "../types";

export function useBotSettingsForm() {
  const t = useTranslations("settings.bot");
  const [settings, setSettings] = useState<BotSettings>({
    telegram_ai_enabled: false,
    ai_provider: "openai_compatible",
    anthropic_api_key: "",
    openai_compatible_api_key: "",
    openai_compatible_base_url: QWEN_BASE_URL,
    telegram_ai_model: "qwen-plus",
    telegram_plan_basic_limit: 10,
    telegram_plan_pro_limit: 50,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await getBotSettings(SETTINGS_KEYS);

      setSettings({
        telegram_ai_enabled: config["telegram_ai_enabled"] === "true",
        ai_provider: (config["ai_provider"] as AIProvider) || "openai_compatible",
        anthropic_api_key: config["anthropic_api_key"] ? "***configured***" : "",
        openai_compatible_api_key: config["openai_compatible_api_key"] ? "***configured***" : "",
        openai_compatible_base_url: config["openai_compatible_base_url"] || QWEN_BASE_URL,
        telegram_ai_model: config["telegram_ai_model"] || "qwen-plus",
        telegram_plan_basic_limit: parseInt(config["telegram_plan_basic_limit"] || "10", 10),
        telegram_plan_pro_limit: parseInt(config["telegram_plan_pro_limit"] || "50", 10),
      });
    } catch {
      message.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleChange = <K extends keyof BotSettings>(field: K, value: BotSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-switch default model when provider changes
      if (field === "ai_provider") {
        const provider = value as AIProvider;
        next.telegram_ai_model = MODEL_VALUES[provider][0];
        if (provider === "openai_compatible" && !next.openai_compatible_base_url) {
          next.openai_compatible_base_url = QWEN_BASE_URL;
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updates: { key: string; value: string; updated_at: string }[] = [
        { key: "telegram_ai_enabled", value: String(settings.telegram_ai_enabled), updated_at: now },
        { key: "ai_provider", value: settings.ai_provider, updated_at: now },
        { key: "telegram_ai_model", value: settings.telegram_ai_model, updated_at: now },
        { key: "openai_compatible_base_url", value: settings.openai_compatible_base_url, updated_at: now },
        { key: "telegram_plan_basic_limit", value: String(settings.telegram_plan_basic_limit), updated_at: now },
        { key: "telegram_plan_pro_limit", value: String(settings.telegram_plan_pro_limit), updated_at: now },
      ];

      if (settings.anthropic_api_key && settings.anthropic_api_key !== "***configured***") {
        updates.push({ key: "anthropic_api_key", value: settings.anthropic_api_key, updated_at: now });
      }
      if (settings.openai_compatible_api_key && settings.openai_compatible_api_key !== "***configured***") {
        updates.push({ key: "openai_compatible_api_key", value: settings.openai_compatible_api_key, updated_at: now });
      }

      await saveBotSettings(updates);

      message.success(t("saved"));
      await load();
    } catch {
      message.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return { settings, loading, saving, handleChange, handleSave };
}
