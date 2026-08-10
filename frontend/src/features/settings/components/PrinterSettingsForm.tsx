"use client";

import { Card, Form, Select, Button, Typography, Skeleton, Input } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useSettings } from "@/features/settings/hooks/useSettings";

const { Title, Text } = Typography;

export function PrinterSettingsForm() {
  const t = useTranslations("settings.printer");
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
          label={t("businessNameLabel")}
          extra={t("businessNameExtra")}
        >
          <Input
            value={settings.printer_business_name}
            onChange={(event) => handleChange("printer_business_name", event.target.value)}
            maxLength={48}
          />
        </Form.Item>

        <Form.Item
          label={t("widthLabel")}
          extra={t("widthExtra")}
        >
          <Select
            value={settings.printer_paper_width}
            onChange={(val) => handleChange("printer_paper_width", val)}
            style={{ width: 220 }}
            options={[
              { value: 58, label: t("width58") },
              { value: 80, label: t("width80") },
            ]}
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
