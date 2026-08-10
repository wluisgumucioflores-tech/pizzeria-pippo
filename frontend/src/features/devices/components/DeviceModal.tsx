"use client";

import { useEffect } from "react";
import { Modal, Form, Input, Select } from "antd";
import { useTranslations } from "next-intl";
import type { Branch } from "@/features/branches/types/branch.types";
import type { Device } from "../types/device.types";

interface Props {
  open: boolean;
  editing: Device | null;
  branches: Branch[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { branch_id: string; name: string }) => Promise<void>;
}

export function DeviceModal({ open, editing, branches, saving, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<{ branch_id: string; name: string }>();
  const t = useTranslations("common");
  const td = useTranslations("devices.modal");

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        editing ? { branch_id: editing.branch_id, name: editing.name } : { branch_id: undefined, name: "" }
      );
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      title={editing ? td("editTitle") : td("createTitle")}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      okText={editing ? t("save") : t("create")}
      cancelText={t("cancel")}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label={td("name")}
          rules={[{ required: true, message: td("nameRequired") }]}
          extra={td("nameHint")}
        >
          <Input placeholder={td("namePlaceholder")} />
        </Form.Item>

        <Form.Item
          name="branch_id"
          label={td("branch")}
          rules={[{ required: true, message: td("branchRequired") }]}
          extra={editing ? td("branchLockedHint") : undefined}
        >
          <Select disabled={!!editing} placeholder={td("branchPlaceholder")}>
            {branches.map((branch) => (
              <Select.Option key={branch.id} value={branch.id}>{branch.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
