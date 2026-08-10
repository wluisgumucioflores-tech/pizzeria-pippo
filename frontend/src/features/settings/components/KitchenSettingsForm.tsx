"use client";

import { Card, Form, InputNumber, Button, Typography, Skeleton } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useSettings } from "@/features/settings/hooks/useSettings";

const { Title, Text } = Typography;

export function KitchenSettingsForm() {
  const t = useTranslations("settings.kitchen");
  const tc = useTranslations("common");
  const { settings, loading, saving, handleChange, handleSave } = useSettings();

  if (loading) return <Skeleton active paragraph={{ rows: 3 }} />;

  return (
    <Card style={{ maxWidth: 400 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item
          label={t("thresholdLabel")}
          extra={t("thresholdExtra")}
        >
          <InputNumber
            min={1}
            max={120}
            value={settings.kitchen_late_threshold_minutes}
            onChange={(val) => handleChange("kitchen_late_threshold_minutes", val ?? 10)}
            addonAfter="min"
            style={{ width: 140 }}
          />
        </Form.Item>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          {tc("save")}
        </Button>
      </Form>
    </Card>
  );
}
