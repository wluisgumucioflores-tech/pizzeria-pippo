"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { useTranslations } from "next-intl";
import { AppSettings } from "@/features/settings/types";
import { getSettings, saveSettings, testConnection } from "@/features/settings/services/settings.service";

export function useSettings() {
  const t = useTranslations("settings.errors");
  const [settings, setSettings] = useState<AppSettings>({
    telegram_bot_token: "",
    telegram_chat_id: "",
    telegram_enabled: false,
    kitchen_late_threshold_minutes: 10,
    printer_paper_width: 58,
    printer_business_name: "GU PIZZA",
    use_stock: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
    } catch {
      message.error(t("loadSettings"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleChange = useCallback((field: keyof AppSettings, value: string | boolean | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setTestResult("idle");
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult("idle");
    setTestError("");
    try {
      const result = await testConnection(settings.telegram_bot_token, settings.telegram_chat_id);
      if (result.ok) {
        setTestResult("success");
      } else {
        setTestResult("error");
        setTestError(result.error ?? t("testUnknownError"));
      }
    } catch {
      setTestResult("error");
      setTestError(t("testConnFailed"));
    } finally {
      setTesting(false);
    }
  }, [settings.telegram_bot_token, settings.telegram_chat_id, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      message.success(t("saved"));
      await load();
    } catch {
      message.error(t("saveSettings"));
    } finally {
      setSaving(false);
    }
  }, [settings, load, t]);

  return {
    settings,
    loading,
    saving,
    testing,
    testResult,
    testError,
    handleChange,
    handleTest,
    handleSave,
  };
}
