"use client";

import { Card, Form, Input, InputNumber, Select, Button, Typography, Skeleton, Alert, Radio, Space } from "antd";
import { SaveOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import {
  MAX_ONLINE_ORDERS_EXPIRE_MINUTES,
  MIN_ONLINE_ORDERS_EXPIRE_MINUTES,
  type OnlineMenuMode,
} from "@pippo/shared";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { useCategoryOptions } from "@/features/categories/hooks/useCategoryOptions";
import { useProductOptions } from "@/features/products/hooks/useProductOptions";

const { Title, Text } = Typography;

const WHATSAPP_NUMBER = /^\+?[0-9]{8,15}$/;

export function OnlineOrdersSettingsForm() {
  const t = useTranslations("settings.onlineOrders");
  const tc = useTranslations("common");
  const { settings, loading, saving, handleChange, handleSave } = useSettings();
  const { options: categoryOptions } = useCategoryOptions();
  const { options: productOptions } = useProductOptions();

  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;

  const mode = settings.online_menu_mode;
  const whatsapp = settings.online_orders_whatsapp;
  // Empty is a valid saved state (nothing configured yet) — only a non-empty
  // value that isn't a phone number is an error worth blocking the save for.
  const whatsappInvalid = whatsapp !== "" && !WHATSAPP_NUMBER.test(whatsapp);
  const missingSelection =
    (mode === "categories" && settings.online_menu_category_ids.length === 0) ||
    (mode === "products" && settings.online_menu_product_ids.length === 0);

  return (
    <Card style={{ maxWidth: 640 }}>
      <Title level={4} style={{ marginBottom: 4 }}>{t("title")}</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {t("description")}
      </Text>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message={t("whatsappNoticeTitle")}
        description={t("whatsappNoticeBody")}
      />

      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item
          label={t("whatsappLabel")}
          extra={t("whatsappExtra")}
          validateStatus={whatsappInvalid ? "error" : undefined}
          help={whatsappInvalid ? t("whatsappInvalid") : undefined}
        >
          <Input
            prefix={<WhatsAppOutlined />}
            placeholder="+59170000000"
            value={whatsapp}
            onChange={(e) => handleChange("online_orders_whatsapp", e.target.value.trim())}
            style={{ maxWidth: 280 }}
          />
        </Form.Item>

        <Form.Item label={t("expireLabel")} extra={t("expireExtra")}>
          <InputNumber
            min={MIN_ONLINE_ORDERS_EXPIRE_MINUTES}
            max={MAX_ONLINE_ORDERS_EXPIRE_MINUTES}
            value={settings.online_orders_expire_minutes}
            onChange={(val) =>
              handleChange("online_orders_expire_minutes", val ?? MIN_ONLINE_ORDERS_EXPIRE_MINUTES)
            }
            addonAfter={t("minutes")}
            style={{ width: 180 }}
          />
        </Form.Item>

        <Form.Item label={t("menuModeLabel")} extra={t("menuModeExtra")}>
          <Radio.Group
            value={mode}
            onChange={(e) => handleChange("online_menu_mode", e.target.value as OnlineMenuMode)}
          >
            <Space direction="vertical">
              <Radio value="all">{t("menuModeAll")}</Radio>
              <Radio value="categories">{t("menuModeCategories")}</Radio>
              <Radio value="products">{t("menuModeProducts")}</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        {mode === "categories" && (
          <Form.Item label={t("categoriesLabel")} extra={t("categoriesExtra")}>
            <Select
              mode="multiple"
              allowClear
              placeholder={t("categoriesPlaceholder")}
              value={settings.online_menu_category_ids}
              onChange={(val) => handleChange("online_menu_category_ids", val)}
              options={categoryOptions}
              style={{ width: "100%" }}
            />
          </Form.Item>
        )}

        {mode === "products" && (
          <Form.Item label={t("productsLabel")} extra={t("productsExtra")}>
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t("productsPlaceholder")}
              value={settings.online_menu_product_ids}
              onChange={(val) => handleChange("online_menu_product_ids", val)}
              options={productOptions}
              style={{ width: "100%" }}
            />
          </Form.Item>
        )}

        {missingSelection && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={t("emptySelectionWarning")}
          />
        )}

        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={whatsappInvalid}
          onClick={handleSave}
        >
          {tc("save")}
        </Button>
      </Form>
    </Card>
  );
}
