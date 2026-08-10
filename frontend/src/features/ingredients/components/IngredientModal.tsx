"use client";

import { Modal, Form, Input, Select, Checkbox, Button } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import { getUnitOptions } from "../constants/ingredient.constants";
import type { Ingredient } from "../types/ingredient.types";

interface Props {
  open: boolean;
  editing: Ingredient | null;
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { name: string; unit: string; is_shared_use?: boolean }) => void;
}

export function IngredientModal({ open, editing, saving, form, onClose, onSubmit }: Props) {
  const t = useTranslations("common");
  const ti = useTranslations("ingredients");
  const tm = useTranslations("ingredients.modal");
  const UNIT_OPTIONS = getUnitOptions(ti);

  return (
    <Modal
      title={editing ? tm("editTitle") : tm("createTitle")}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item label={tm("name")} name="name" rules={[{ required: true, message: tm("nameRequired") }]}>
          <Input placeholder={tm("namePlaceholder")} />
        </Form.Item>
        <Form.Item label={tm("unit")} name="unit" rules={[{ required: true, message: tm("unitRequired") }]}>
          <Select placeholder={tm("unitPlaceholder")} options={UNIT_OPTIONS} />
        </Form.Item>
        <Form.Item name="is_shared_use" valuePropName="checked">
          <Checkbox>
            {tm("sharedUseLabel")}
            <div className="text-xs text-gray-400">{tm("sharedUseHint")}</div>
          </Checkbox>
        </Form.Item>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? tm("saveChanges") : tm("create")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
