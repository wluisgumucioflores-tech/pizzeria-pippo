"use client";

import { Card, Form, InputNumber, Select, Button, Typography, Skeleton, ColorPicker, Alert, Row, Col, Divider, Space } from "antd";
import { SaveOutlined, EyeOutlined, ClockCircleOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { useCategoryOptions } from "@/features/categories/hooks/useCategoryOptions";
import { getReadableTextColor } from "@/features/kitchen/constants/kitchen-stage.constants";

const { Title, Text } = Typography;

const PREVIEW_ORDERS = [104, 102, 98];

export function KitchenSettingsForm() {
  const t = useTranslations("settings.kitchen");
  const { settings, loading, saving, handleChange, handleSave } = useSettings();
  const { options: categoryOptions } = useCategoryOptions();

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;

  const stagesOrderInvalid =
    settings.kitchen_stage_warning_minutes >= settings.kitchen_late_threshold_minutes;

  const previewStages = [
    { label: t("previewFresh"), color: settings.kitchen_color_fresh, minutesLabel: "0 min" },
    {
      label: t("previewWarning"),
      color: settings.kitchen_color_warning,
      minutesLabel: `${settings.kitchen_stage_warning_minutes} min`,
    },
    {
      label: t("previewLate"),
      color: settings.kitchen_color_late,
      minutesLabel: `${settings.kitchen_late_threshold_minutes}+ min`,
    },
  ];

  const colorSwatches = [
    { key: "kitchen_color_fresh" as const, label: t("colorFreshLabel") },
    { key: "kitchen_color_warning" as const, label: t("colorWarningLabel") },
    { key: "kitchen_color_late" as const, label: t("colorLateLabel") },
  ];

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Form layout="vertical" onFinish={handleSave}>
        <Row gutter={32}>
          <Col xs={24} md={12}>
            <Title level={5} style={{ marginBottom: 4 }}>{t("alertTimesTitle")}</Title>
            <Divider style={{ margin: "0 0 16px" }} />

            <Form.Item label={t("warningLabel")} extra={t("warningExtra")}>
              <MinuteStepper
                value={settings.kitchen_stage_warning_minutes}
                min={1}
                max={119}
                onChange={(val) => handleChange("kitchen_stage_warning_minutes", val)}
              />
            </Form.Item>

            <Form.Item label={t("thresholdLabel")} extra={t("thresholdExtra")}>
              <MinuteStepper
                value={settings.kitchen_late_threshold_minutes}
                min={2}
                max={120}
                onChange={(val) => handleChange("kitchen_late_threshold_minutes", val)}
              />
            </Form.Item>

            {stagesOrderInvalid && (
              <Alert type="error" showIcon style={{ marginBottom: 16 }} message={t("stagesOrderError")} />
            )}

            <Title level={5} style={{ marginBottom: 4 }}>{t("displayTitle")}</Title>
            <Divider style={{ margin: "0 0 16px" }} />

            <Form.Item label={t("displayModeLabel")} extra={t("displayModeExtra")}>
              <Select
                mode="multiple"
                allowClear
                placeholder={t("displayModeAllCategories")}
                value={settings.kitchen_visible_category_ids}
                onChange={(val) => handleChange("kitchen_visible_category_ids", val)}
                options={categoryOptions}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Card size="small" style={{ background: "#fafafa" }}>
              <Space align="center" style={{ marginBottom: 16 }}>
                <EyeOutlined />
                <Text strong>{t("previewLabel")}</Text>
              </Space>

              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {previewStages.map((stage, i) => (
                  <div
                    key={stage.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderRadius: 10,
                      padding: "10px 14px",
                      backgroundColor: stage.color,
                      color: getReadableTextColor(stage.color),
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                        {t("previewOrderNumber", { number: PREVIEW_ORDERS[i] })}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{stage.label}</div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        background: "rgba(0,0,0,0.15)",
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <ClockCircleOutlined />
                      {stage.minutesLabel}
                    </div>
                  </div>
                ))}
              </Space>

              <Divider style={{ margin: "16px 0" }} />

              <Text strong style={{ display: "block", marginBottom: 12 }}>
                {t("colorsLabel")}
              </Text>
              <div style={{ display: "flex", gap: 24 }}>
                {colorSwatches.map((swatch) => (
                  <Form.Item key={swatch.key} label={swatch.label} style={{ marginBottom: 0 }}>
                    <ColorPicker
                      disabledAlpha
                      value={settings[swatch.key]}
                      onChangeComplete={(color) => handleChange(swatch.key, color.toHexString())}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          backgroundColor: settings[swatch.key],
                          cursor: "pointer",
                          border: "1px solid rgba(0,0,0,0.1)",
                        }}
                      />
                    </ColorPicker>
                  </Form.Item>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={stagesOrderInvalid}
            onClick={handleSave}
          >
            {t("saveButton")}
          </Button>
        </div>
      </Form>
    </Card>
  );
}

function MinuteStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Space align="center">
      <Space.Compact>
        <Button
          icon={<MinusOutlined />}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        />
        <InputNumber
          min={min}
          max={max}
          value={value}
          onChange={(val) => onChange(val ?? min)}
          style={{ width: 90 }}
        />
        <Button
          icon={<PlusOutlined />}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        />
      </Space.Compact>
      <Text type="secondary">min</Text>
    </Space>
  );
}
