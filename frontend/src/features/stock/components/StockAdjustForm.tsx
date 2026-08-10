"use client";

import { Form, Select, InputNumber, Input, Button, Typography } from "antd";
import { useTranslations } from "next-intl";

const IconTool = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);
import type { FormInstance } from "antd";
import type { Ingredient } from "../types/stock.types";

const { Text } = Typography;

interface Props {
  form: FormInstance;
  ingredients: Ingredient[];
  onSubmit: (values: { ingredient_id: string; real_quantity: number; notes?: string }) => void;
}

export function StockAdjustForm({ form, ingredients, onSubmit }: Props) {
  const t = useTranslations("stock.adjustForm");

  return (
    <div className="max-w-md">
      <Text type="secondary" className="block mb-4">
        {t("helperText")}
      </Text>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item label={t("ingredientLabel")} name="ingredient_id" rules={[{ required: true, message: t("required") }]}>
          <Select
            showSearch
            placeholder={t("ingredientPlaceholder")}
            options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
            filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item label={t("realQuantity")} name="real_quantity" rules={[{ required: true, message: t("required") }]}>
          <InputNumber min={0} style={{ width: "100%" }} placeholder={t("realQuantityPlaceholderIngredient")} />
        </Form.Item>
        <Form.Item label={t("reason")} name="notes">
          <Input.TextArea rows={2} placeholder={t("reasonPlaceholder")} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<IconTool />}>
          {t("submit")}
        </Button>
      </Form>
    </div>
  );
}
