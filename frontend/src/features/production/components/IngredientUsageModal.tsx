"use client";

import { Modal, Form, Select, InputNumber, Button } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import type { Ingredient } from "@pippo/shared";
import type { IngredientUsageLog } from "../types/production.types";

interface Props {
  open: boolean;
  saving: boolean;
  editing: IngredientUsageLog | null;
  ingredients: Ingredient[];
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { ingredient_id: string; quantity: number }) => void;
}

export function IngredientUsageModal({ open, saving, editing, ingredients, form, onClose, onSubmit }: Props) {
  const t = useTranslations("production");
  const tc = useTranslations("common");

  return (
    <Modal
      title={editing ? t("ingredientUsage.modalEditTitle") : t("ingredientUsage.modalTitle")}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item
          label={t("ingredientUsage.ingredientLabel")}
          name="ingredient_id"
          rules={[{ required: true, message: t("required") }]}
        >
          <Select
            showSearch
            placeholder={t("ingredientUsage.ingredientPlaceholder")}
            options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
            filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item
          label={t("quantity")}
          name="quantity"
          rules={[{ required: true, message: t("required") }, { type: "number", min: 0.001, message: t("quantityMin") }]}
        >
          <InputNumber style={{ width: "100%" }} placeholder={t("quantityPlaceholder")} />
        </Form.Item>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>{tc("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? t("ingredientUsage.saveChanges") : t("ingredientUsage.submit")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
