"use client";

import { Form, Select, InputNumber, Input, Button } from "antd";
import { useTranslations } from "next-intl";
import type { FormInstance } from "antd";
import type { ProductVariantOption } from "../types/stock.types";

interface Props {
  form: FormInstance;
  variants: ProductVariantOption[];
  onSubmit: (values: { variant_id: string; real_quantity: number; notes?: string }) => void;
}

export function ProductStockAdjustForm({ form, variants, onSubmit }: Props) {
  const t = useTranslations("stock.adjustForm");

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
          />
        </Form.Item>
        <Form.Item label={t("realQuantity")} name="real_quantity" rules={[{ required: true, message: t("required") }]}>
          <InputNumber min={0} style={{ width: "100%" }} placeholder={t("realQuantityPlaceholderProduct")} />
        </Form.Item>
        <Form.Item label={t("notes")} name="notes">
          <Input.TextArea rows={2} placeholder={t("notesPlaceholder")} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          {t("submit")}
        </Button>
      </Form>
    </div>
  );
}
