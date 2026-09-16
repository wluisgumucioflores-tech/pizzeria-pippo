"use client";

import { Card, Form, Select, InputNumber, Button, Typography, Skeleton, Alert } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { FormInstance } from "antd";
import type { Branch, WarehouseStockOption } from "../types/production.types";

const { Title, Text } = Typography;

interface Props {
  form: FormInstance;
  branches: Branch[];
  stock: WarehouseStockOption[];
  available: number | null;
  saving: boolean;
  loading: boolean;
  onVariantChange: (variantId: string) => void;
  onSubmit: (values: { variant_id: string; branch_id: string; quantity: number }) => void;
}

export function ProductionTransferForm({ form, branches, stock, available, saving, loading, onVariantChange, onSubmit }: Props) {
  const t = useTranslations("production");

  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;

  const withStock = stock.filter((s) => s.quantity > 0);

  return (
    <div className="p-3 md:p-6">
      <Card style={{ maxWidth: 480 }}>
        <Title level={4} style={{ marginBottom: 4 }}>{t("transfer.title")}</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
          {t("transfer.description")}
        </Text>

        {withStock.length === 0 && (
          <Alert type="info" showIcon message={t("transfer.emptyStock")} style={{ marginBottom: 16 }} />
        )}

        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            label={t("transfer.productLabel")}
            name="variant_id"
            rules={[{ required: true, message: t("required") }]}
          >
            <Select
              showSearch
              placeholder={t("transfer.productPlaceholder")}
              disabled={withStock.length === 0}
              onChange={onVariantChange}
              options={withStock.map((s) => ({
                value: s.variant_id,
                label: `${s.product_variants?.products?.name ?? ""} — ${s.product_variants?.name ?? ""} (${s.quantity})`,
              }))}
              filterOption={(input, option) => (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>

          {available !== null && (
            <Text type="secondary" style={{ display: "block", marginTop: -16, marginBottom: 16 }}>
              {t("transfer.availableLabel", { quantity: available })}
            </Text>
          )}

          <Form.Item
            label={t("transfer.branchLabel")}
            name="branch_id"
            rules={[{ required: true, message: t("required") }]}
          >
            <Select
              placeholder={t("transfer.branchPlaceholder")}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Form.Item>

          <Form.Item
            label={t("quantity")}
            name="quantity"
            rules={[{ required: true, message: t("required") }, { type: "number", min: 0.001, message: t("quantityMin") }]}
          >
            <InputNumber style={{ width: "100%" }} placeholder={t("quantityPlaceholder")} />
          </Form.Item>

          <Button type="primary" icon={<SendOutlined />} htmlType="submit" loading={saving} disabled={withStock.length === 0}>
            {t("transfer.submit")}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
