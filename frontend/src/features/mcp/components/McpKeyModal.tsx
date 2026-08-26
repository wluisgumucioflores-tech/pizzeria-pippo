"use client";

import { useEffect } from "react";
import { Modal, Form, Input } from "antd";
import { useTranslations } from "next-intl";

interface Props {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string }) => Promise<void>;
}

export function McpKeyModal({ open, saving, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<{ name: string }>();
  const t = useTranslations("common");
  const tm = useTranslations("mcp.modal");

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      title={tm("createTitle")}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      okText={t("create")}
      cancelText={t("cancel")}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label={tm("name")}
          rules={[{ required: true, message: tm("nameRequired") }]}
          extra={tm("nameHint")}
        >
          <Input placeholder={tm("namePlaceholder")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
