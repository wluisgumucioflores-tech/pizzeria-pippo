"use client";

import { Card, Form, Input, Switch, Button, Space, Divider, Typography, Skeleton } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { TestConnectionButton } from "./TestConnectionButton";
import { useSettings } from "@/features/settings/hooks/useSettings";

const { Title, Text } = Typography;

export function TelegramSettingsForm() {
  const t = useTranslations("settings.telegram");
  const tc = useTranslations("common");
  const {
    settings,
    loading,
    saving,
    testing,
    testResult,
    testError,
    handleChange,
    handleTest,
    handleSave,
  } = useSettings();

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;

  const canTest = !!settings.telegram_bot_token && !!settings.telegram_chat_id;
  const canSave = canTest;

  return (
    <Card style={{ maxWidth: 560 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item
          label={t("botTokenLabel")}
          extra={t("botTokenExtra")}
        >
          <Input.Password
            value={settings.telegram_bot_token}
            onChange={(e) => handleChange("telegram_bot_token", e.target.value)}
            placeholder="123456:ABCdef..."
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label={t("chatIdLabel")}
          extra={t("chatIdExtra")}
        >
          <Input
            value={settings.telegram_chat_id}
            onChange={(e) => handleChange("telegram_chat_id", e.target.value)}
            placeholder="-1001234567890"
          />
        </Form.Item>

        <Form.Item label={t("enabledLabel")}>
          <Switch
            checked={settings.telegram_enabled}
            onChange={(checked) => handleChange("telegram_enabled", checked)}
          />
        </Form.Item>

        <Divider />

        <Space>
          <TestConnectionButton
            testing={testing}
            testResult={testResult}
            testError={testError}
            disabled={!canTest}
            onTest={handleTest}
          />

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!canSave}
            onClick={handleSave}
          >
            {tc("save")}
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
