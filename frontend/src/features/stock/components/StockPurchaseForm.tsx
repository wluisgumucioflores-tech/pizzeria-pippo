"use client";

import { Form, Select, InputNumber, Button } from "antd";
import { useTranslations } from "next-intl";

const IconPlus = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
import type { FormInstance } from "antd";
import type { Ingredient } from "../types/stock.types";

interface Props {
  form: FormInstance;
  ingredients: Ingredient[];
  isNewIngredient: boolean;
  onIngredientChange: (id: string) => void;
  onSubmit: (values: { ingredient_id: string; quantity: number; min_quantity?: number }) => void;
}

export function StockPurchaseForm({ form, ingredients, isNewIngredient, onIngredientChange, onSubmit }: Props) {
  const t = useTranslations("stock.purchaseForm");

  return (
    <div className="max-w-md">
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item label={t("ingredientLabel")} name="ingredient_id" rules={[{ required: true, message: t("required") }]}>
          <Select
            showSearch
            placeholder={t("ingredientPlaceholder")}
            options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
            filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            onChange={onIngredientChange}
          />
        </Form.Item>
        <Form.Item
          label={t("quantity")}
          name="quantity"
          rules={[
            { required: true, message: t("required") },
            { type: "number", min: 0.001, message: t("quantityMin") },
          ]}
        >
          <InputNumber style={{ width: "100%" }} placeholder={t("quantityPlaceholder")} />
        </Form.Item>
        {isNewIngredient && (
          <Form.Item
            label={t("minQuantity")}
            name="min_quantity"
            tooltip={t("minQuantityTooltipIngredient")}
            rules={[{ required: true, message: t("minQuantityRequiredIngredient") }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder={t("minQuantityPlaceholder")} />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" icon={<IconPlus />}>
          {t("submit")}
        </Button>
      </Form>
    </div>
  );
}
