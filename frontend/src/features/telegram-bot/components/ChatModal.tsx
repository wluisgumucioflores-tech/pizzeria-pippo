"use client";

import { useEffect } from "react";
import { Modal, Form, Input, Select } from "antd";
import { useTranslations } from "next-intl";
import { AuthorizedChat, ChatFormValues } from "@/features/telegram-bot/types";

interface Props {
  open: boolean;
  editing: AuthorizedChat | null;
  onClose: () => void;
  onSave: (values: ChatFormValues) => Promise<void>;
}

export function ChatModal({ open, editing, onClose, onSave }: Props) {
  const [form] = Form.useForm<ChatFormValues>();
  const t = useTranslations("common");
  const tc = useTranslations("settings.chats");

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        editing
          ? { chat_id: editing.chat_id, type: editing.type, label: editing.label, plan: editing.plan }
          : { type: "group", plan: "basic", chat_id: "", label: "" }
      );
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSave(values);
  };

  return (
    <Modal
      title={editing ? tc("editTitle") : tc("addTitle")}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={editing ? t("save") : tc("authorize")}
      cancelText={t("cancel")}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="chat_id"
          label={tc("chatIdLabel")}
          rules={[{ required: true, message: tc("chatIdRequired") }]}
          extra={tc("chatIdExtra")}
        >
          <Input placeholder="-1001234567890" disabled={!!editing} />
        </Form.Item>

        <Form.Item
          name="type"
          label={tc("typeLabel")}
          rules={[{ required: true }]}
        >
          <Select disabled={!!editing}>
            <Select.Option value="personal">{tc("typePersonal")}</Select.Option>
            <Select.Option value="group">{tc("typeGroup")}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="label"
          label={tc("nameLabel")}
          rules={[{ required: true, message: tc("nameRequired") }]}
        >
          <Input placeholder={tc("namePlaceholder")} />
        </Form.Item>

        <Form.Item
          name="plan"
          label={tc("planLabel")}
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="basic">{tc("planBasicOption")}</Select.Option>
            <Select.Option value="pro">{tc("planProOption")}</Select.Option>
            <Select.Option value="unlimited">{tc("planUnlimitedOption")}</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
