"use client";

import { useEffect } from "react";
import { Modal, Form, Input, Select, AutoComplete } from "antd";
import { useTranslations } from "next-intl";
import type { Branch } from "@/features/branches/types/branch.types";
import type { Employee } from "../types/employee.types";
import { POSITION_OPTIONS } from "../constants/position-options";

interface Props {
  open: boolean;
  editing: Employee | null;
  branches: Branch[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { branch_id: string; full_name: string; position: string }) => Promise<void>;
}

export function EmployeeModal({ open, editing, branches, saving, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<{ branch_id: string; full_name: string; position: string }>();
  const t = useTranslations("common");
  const te = useTranslations("employees.modal");

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        editing
          ? { branch_id: editing.branch_id, full_name: editing.full_name, position: editing.position }
          : { branch_id: undefined, full_name: "", position: "" }
      );
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      title={editing ? te("editTitle") : te("createTitle")}
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
          name="full_name"
          label={te("fullName")}
          rules={[{ required: true, message: te("fullNameRequired") }]}
        >
          <Input placeholder={te("fullNamePlaceholder")} />
        </Form.Item>

        <Form.Item
          name="position"
          label={te("position")}
          rules={[{ required: true, message: te("positionRequired") }]}
        >
          <AutoComplete
            options={POSITION_OPTIONS.map((p) => ({ value: p }))}
            filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
            placeholder={te("positionPlaceholder")}
          />
        </Form.Item>

        <Form.Item
          name="branch_id"
          label={te("branch")}
          rules={[{ required: true, message: te("branchRequired") }]}
        >
          <Select placeholder={te("branchPlaceholder")}>
            {branches.map((branch) => (
              <Select.Option key={branch.id} value={branch.id}>{branch.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
