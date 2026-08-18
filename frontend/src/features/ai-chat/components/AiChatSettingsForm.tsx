"use client";

import { Card, Form, Input, Select, AutoComplete, Button, Space, Divider, Typography, Skeleton } from "antd";
import { SaveOutlined, KeyOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useAiChatSettingsForm } from "../hooks/useAiChatSettingsForm";
import { getModels } from "../constants/ai-chat-settings.constants";
import { AiChatApiKeyModal } from "./AiChatApiKeyModal";

const { Title, Text } = Typography;

export function AiChatSettingsForm() {
  const t = useTranslations("settings.aiChat");
  const tc = useTranslations("common");
  const {
    settings, loading, saving, generatingKey, newApiKey,
    handleChange, handleSave, handleGenerateKey, closeApiKeyModal,
  } = useAiChatSettingsForm();

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

  const isAnthropicProvider = settings.ai_chat_provider === "anthropic";
  const models = getModels(t);

  return (
    <Card style={{ maxWidth: 560 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical">
        <Form.Item label={t("providerLabel")}>
          <Select
            value={settings.ai_chat_provider}
            onChange={(v) => handleChange("ai_chat_provider", v)}
          >
            <Select.Option value="anthropic">{t("providerAnthropic")}</Select.Option>
            <Select.Option value="openai_compatible">{t("providerOpenAI")}</Select.Option>
          </Select>
        </Form.Item>

        {isAnthropicProvider ? (
          <Form.Item label={t("anthropicKeyLabel")} extra={t("apiKeyExtra")}>
            <Input.Password
              value={settings.ai_chat_anthropic_api_key}
              onChange={(e) => handleChange("ai_chat_anthropic_api_key", e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item label={t("apiKeyLabel")} extra={t("apiKeyExtra")}>
              <Input.Password
                value={settings.ai_chat_openai_compatible_api_key}
                onChange={(e) => handleChange("ai_chat_openai_compatible_api_key", e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item label={t("baseUrlLabel")} extra={t("baseUrlExtra")}>
              <Input
                value={settings.ai_chat_openai_compatible_base_url}
                onChange={(e) => handleChange("ai_chat_openai_compatible_base_url", e.target.value)}
                placeholder="https://..."
              />
            </Form.Item>
          </>
        )}

        <Form.Item label={t("modelLabel")} extra={t("modelExtra")}>
          <AutoComplete
            value={settings.ai_chat_model}
            onChange={(v) => handleChange("ai_chat_model", v)}
            options={models[settings.ai_chat_provider].map((m) => ({ value: m.value, label: m.label }))}
            placeholder={isAnthropicProvider ? "claude-haiku-4-5-20251001" : "qwen3:4b"}
            filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>

        <Divider />

        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          {tc("save")}
        </Button>

        <Divider orientation="left" orientationMargin={0}>{t("internalKeySection")}</Divider>

        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          {t("internalKeyDescription")}
        </Text>

        <Space>
          <Button icon={<KeyOutlined />} loading={generatingKey} onClick={handleGenerateKey}>
            {t("generateKeyButton")}
          </Button>
        </Space>
      </Form>

      <AiChatApiKeyModal apiKey={newApiKey} onClose={closeApiKeyModal} />
    </Card>
  );
}
