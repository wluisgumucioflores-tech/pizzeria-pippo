"use client";

import { Modal, Form, Select, InputNumber, Button } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import type { VariantOption, OutputLog } from "../types/production.types";

interface Props {
  open: boolean;
  saving: boolean;
  editing: OutputLog | null;
  variants: VariantOption[];
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { variant_id: string; quantity: number }) => void;
}

export function ProductionOutputModal({ open, saving, editing, variants, form, onClose, onSubmit }: Props) {
  const t = useTranslations("production");
  const tc = useTranslations("common");

  return (
    <Modal
      title={editing ? t("output.modalEditTitle") : t("output.modalTitle")}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item
          label={t("output.variantLabel")}
          name="variant_id"
          rules={[{ required: true, message: t("required") }]}
        >
          <Select
            showSearch
            placeholder={t("output.variantPlaceholder")}
            options={variants.map((v) => ({ value: v.id, label: `${v.product_name} — ${v.name}` }))}
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
            {editing ? t("output.saveChanges") : t("output.submit")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
