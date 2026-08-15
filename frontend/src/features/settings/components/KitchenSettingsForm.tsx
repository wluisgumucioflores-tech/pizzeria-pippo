"use client";

import { Card, Form, InputNumber, Radio, Button, Typography, Skeleton, ColorPicker, Alert } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { getReadableTextColor } from "@/features/kitchen/constants/kitchen-stage.constants";

const { Title, Text } = Typography;

export function KitchenSettingsForm() {
  const t = useTranslations("settings.kitchen");
  const tc = useTranslations("common");
  const { settings, loading, saving, handleChange, handleSave } = useSettings();

  if (loading) return <Skeleton active paragraph={{ rows: 3 }} />;

  const stagesOrderInvalid =
    settings.kitchen_stage_warning_minutes >= settings.kitchen_late_threshold_minutes;

  const previewStages = [
    { label: t("previewFresh"), color: settings.kitchen_color_fresh, minutes: 3 },
    { label: t("previewWarning"), color: settings.kitchen_color_warning, minutes: settings.kitchen_stage_warning_minutes },
    { label: t("previewLate"), color: settings.kitchen_color_late, minutes: settings.kitchen_late_threshold_minutes },
  ];

  return (
    <Card style={{ maxWidth: 480 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item label={t("warningLabel")} extra={t("warningExtra")}>
          <InputNumber
            min={1}
            max={119}
            value={settings.kitchen_stage_warning_minutes}
            onChange={(val) => handleChange("kitchen_stage_warning_minutes", val ?? 7)}
            addonAfter="min"
            style={{ width: 140 }}
          />
        </Form.Item>

        <Form.Item label={t("thresholdLabel")} extra={t("thresholdExtra")}>
          <InputNumber
            min={2}
            max={120}
            value={settings.kitchen_late_threshold_minutes}
            onChange={(val) => handleChange("kitchen_late_threshold_minutes", val ?? 10)}
            addonAfter="min"
            style={{ width: 140 }}
          />
        </Form.Item>

        <Form.Item
          label={t("displayModeLabel")}
          extra={t("displayModeExtra")}
        >
          <Radio.Group
            value={settings.kitchen_display_mode}
            onChange={(e) => handleChange("kitchen_display_mode", e.target.value)}
          >
            <Radio.Button value="full">{t("displayModeFull")}</Radio.Button>
            <Radio.Button value="pizzas_only">{t("displayModePizzasOnly")}</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {stagesOrderInvalid && (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={t("stagesOrderError")} />
        )}

        <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
          <Form.Item label={t("colorFreshLabel")} style={{ marginBottom: 0 }}>
            <ColorPicker
              value={settings.kitchen_color_fresh}
              onChangeComplete={(color) => handleChange("kitchen_color_fresh", color.toHexString())}
            />
          </Form.Item>
          <Form.Item label={t("colorWarningLabel")} style={{ marginBottom: 0 }}>
            <ColorPicker
              value={settings.kitchen_color_warning}
              onChangeComplete={(color) => handleChange("kitchen_color_warning", color.toHexString())}
            />
          </Form.Item>
          <Form.Item label={t("colorLateLabel")} style={{ marginBottom: 0 }}>
            <ColorPicker
              value={settings.kitchen_color_late}
              onChangeComplete={(color) => handleChange("kitchen_color_late", color.toHexString())}
            />
          </Form.Item>
        </div>

        <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
          {t("previewLabel")}
        </Text>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {previewStages.map((stage) => (
            <div
              key={stage.label}
              style={{
                flex: 1,
                borderRadius: 8,
                padding: "8px 12px",
                backgroundColor: stage.color,
                color: getReadableTextColor(stage.color),
                fontSize: 12,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {stage.label}
              <br />
              🕐 {stage.minutes} min
            </div>
          ))}
        </div>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={stagesOrderInvalid}
          onClick={handleSave}
        >
          {tc("save")}
        </Button>
      </Form>
    </Card>
  );
}
