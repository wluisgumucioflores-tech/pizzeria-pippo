"use client";

import { Form, Select, InputNumber, Button } from "antd";
import { useTranslations } from "next-intl";
import type { FormInstance } from "antd";
import type { ProductVariantOption } from "../types/stock.types";

interface Props {
  form: FormInstance;
  variants: ProductVariantOption[];
  isNewVariant: boolean;
  onVariantChange: (variantId: string) => void;
  onSubmit: (values: { variant_id: string; quantity: number; min_quantity?: number }) => void;
}

export function ProductStockPurchaseForm({ form, variants, isNewVariant, onVariantChange, onSubmit }: Props) {
  const t = useTranslations("stock.purchaseForm");

  return (
    <div className="max-w-md">
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item label={t("productLabel")} name="variant_id" rules={[{ required: true, message: t("required") }]}>
          <Select
            showSearch
            placeholder={t("productPlaceholder")}
            options={variants.map((v) => ({
              value: v.variantId,
              label: v.variantName === "Unidad" ? v.productName : `${v.productName} — ${v.variantName}`,
            }))}
            filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            onChange={onVariantChange}
          />
        </Form.Item>
        <Form.Item label={t("quantity")} name="quantity" rules={[{ required: true, message: t("required") }]}>
          <InputNumber min={1} style={{ width: "100%" }} placeholder={t("quantityPlaceholderProduct")} />
        </Form.Item>
        {isNewVariant && (
          <Form.Item
            label={t("minQuantity")}
            name="min_quantity"
            tooltip={t("minQuantityTooltipProduct")}
            rules={[{ required: true, message: t("minQuantityRequiredProduct") }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder={t("minQuantityPlaceholderProduct")} />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit">
          {t("submit")}
        </Button>
      </Form>
    </div>
  );
}
