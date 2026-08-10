"use client";

import { Card, Form, Input, Switch, Select, InputNumber, Button, Space, Divider, Typography, Skeleton } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useBotSettingsForm } from "../hooks/useBotSettingsForm";
import { getModels } from "../constants/bot-settings.constants";

const { Title, Text } = Typography;

export function BotSettingsForm() {
  const t = useTranslations("settings.bot");
  const tc = useTranslations("common");
  const { settings, loading, saving, handleChange, handleSave } = useBotSettingsForm();

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

  const isAnthropicProvider = settings.ai_provider === "anthropic";
  const models = getModels(t);

  return (
    <Card style={{ maxWidth: 560 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical">
        <Form.Item label={t("enableLabel")}>
          <Switch
            checked={settings.telegram_ai_enabled}
            onChange={(v) => handleChange("telegram_ai_enabled", v)}
          />
        </Form.Item>

        <Form.Item label={t("providerLabel")}>
          <Select
            value={settings.ai_provider}
            onChange={(v) => handleChange("ai_provider", v)}
          >
            <Select.Option value="openai_compatible">{t("providerOpenAI")}</Select.Option>
            <Select.Option value="anthropic">{t("providerAnthropic")}</Select.Option>
          </Select>
        </Form.Item>

        {isAnthropicProvider ? (
          <Form.Item label={t("anthropicKeyLabel")} extra={t("apiKeyExtra")}>
            <Input.Password
              value={settings.anthropic_api_key}
              onChange={(e) => handleChange("anthropic_api_key", e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item label={t("apiKeyLabel")} extra={t("apiKeyExtra")}>
              <Input.Password
                value={settings.openai_compatible_api_key}
                onChange={(e) => handleChange("openai_compatible_api_key", e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item
              label={t("baseUrlLabel")}
              extra={t("baseUrlExtra")}
            >
              <Input
                value={settings.openai_compatible_base_url}
                onChange={(e) => handleChange("openai_compatible_base_url", e.target.value)}
                placeholder="https://..."
              />
            </Form.Item>
          </>
        )}

        <Form.Item label={t("modelLabel")}>
          <Select
            value={settings.telegram_ai_model}
            onChange={(v) => handleChange("telegram_ai_model", v)}
          >
            {models[settings.ai_provider].map((m) => (
              <Select.Option key={m.value} value={m.value}>{m.label}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Divider orientation="left" orientationMargin={0}>{t("dailyLimits")}</Divider>

        <Space>
          <Form.Item label={t("basicLimitLabel")} style={{ marginBottom: 0 }}>
            <InputNumber
              min={1}
              value={settings.telegram_plan_basic_limit}
              onChange={(v) => handleChange("telegram_plan_basic_limit", v ?? 10)}
            />
          </Form.Item>
          <Form.Item label={t("proLimitLabel")} style={{ marginBottom: 0 }}>
            <InputNumber
              min={1}
              value={settings.telegram_plan_pro_limit}
              onChange={(v) => handleChange("telegram_plan_pro_limit", v ?? 50)}
            />
          </Form.Item>
        </Space>

        <Divider />

        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          {tc("save")}
        </Button>
      </Form>
    </Card>
  );
}
