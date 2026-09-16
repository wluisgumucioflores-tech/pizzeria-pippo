"use client";

import { Card, Form, Switch, Button, Typography, Skeleton, Alert, Divider } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { DEFAULT_ENABLED_MODULES, type EnabledModules } from "@pippo/shared";
import { useSettings } from "@/features/settings/hooks/useSettings";

const { Title, Text } = Typography;

interface Props {
  enabledModules?: EnabledModules;
}

export function StockSettingsForm({ enabledModules = DEFAULT_ENABLED_MODULES }: Props) {
  const t = useTranslations("settings.stock");
  const tc = useTranslations("common");
  const { settings, loading, saving, handleChange, handleSave } = useSettings();

  if (loading) return <Skeleton active paragraph={{ rows: 3 }} />;

  return (
    <Card style={{ maxWidth: 480 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item label={t("enabledLabel")} extra={t("enabledExtra")}>
          <Switch
            checked={settings.use_stock}
            onChange={(checked) => handleChange("use_stock", checked)}
          />
        </Form.Item>

        {!settings.use_stock && (
          <Alert type="warning" showIcon message={t("disabledWarning")} style={{ marginBottom: 16 }} />
        )}

        {settings.use_stock && (
          <>
            <Divider style={{ margin: "8px 0 16px" }} />

            <Form.Item label={t("deductResaleLabel")} extra={t("deductResaleExtra")}>
              <Switch
                checked={settings.stock_deduct_resale}
                onChange={(checked) => handleChange("stock_deduct_resale", checked)}
              />
            </Form.Item>

            <Form.Item label={t("deductInsumosLabel")} extra={t("deductInsumosExtra")}>
              <Switch
                checked={settings.stock_deduct_insumos}
                onChange={(checked) => handleChange("stock_deduct_insumos", checked)}
              />
            </Form.Item>

            {enabledModules.produccion && (
              <Form.Item label={t("deductMadeUnitLabel")} extra={t("deductMadeUnitExtra")}>
                <Switch
                  checked={settings.stock_deduct_made_unit}
                  onChange={(checked) => handleChange("stock_deduct_made_unit", checked)}
                />
              </Form.Item>
            )}
          </>
        )}

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
