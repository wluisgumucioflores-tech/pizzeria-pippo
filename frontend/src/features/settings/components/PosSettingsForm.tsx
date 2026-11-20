"use client";

import { Card, Divider, Form, Switch, Button, Typography, Skeleton } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { PosCheckoutFlowFields } from "./PosCheckoutFlowFields";

const { Title, Text } = Typography;

export function PosSettingsForm() {
  const t = useTranslations("settings.pos");
  const tc = useTranslations("common");
  const { settings, loading, saving, handleChange, handleSave } = useSettings();

  if (loading) return <Skeleton active paragraph={{ rows: 3 }} />;

  return (
    <Card style={{ maxWidth: 560 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item label={t("enableTableNumberLabel")} extra={t("enableTableNumberExtra")}>
          <Switch
            checked={settings.pos_enable_table_number}
            onChange={(checked) => handleChange("pos_enable_table_number", checked)}
          />
        </Form.Item>

        <Divider orientation="left" plain>{t("checkoutFlowTitle")}</Divider>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          {t("checkoutFlowDescription")}
        </Text>

        <PosCheckoutFlowFields settings={settings} onChange={handleChange} />

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
