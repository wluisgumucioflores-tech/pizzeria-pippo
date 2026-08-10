"use client";

import { useEffect } from "react";
import { Modal, Form, Input } from "antd";
import { useTranslations } from "next-intl";
import type { VariantType } from "../types/variant-type.types";

interface Props {
  open: boolean;
  editing: VariantType | null;
  saving: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}

export function VariantTypeModal({ open, editing, saving, onSave, onClose }: Props) {
  const [form] = Form.useForm();
  const t = useTranslations("common");
  const tv = useTranslations("variantTypes");

  useEffect(() => {
    if (open) {
      form.setFieldsValue(editing ? { name: editing.name } : { name: "" });
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSave(values.name.trim());
  };

  return (
    <Modal
      title={editing ? tv("editTitle") : tv("createTitle")}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={editing ? tv("saveChanges") : t("create")}
      cancelText={t("cancel")}
      confirmLoading={saving}
      afterClose={() => form.resetFields()}
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="name"
          label={tv("nameLabel")}
          rules={[{ required: true, message: tv("nameRequired") }]}
        >
          <Input placeholder={tv("namePlaceholder")} maxLength={50} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
