"use client";

import { Modal, Form, Input, Select, Button } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import { getRoleOptions } from "../constants/user.constants";
import type { User, Branch, UserRole } from "../types/user.types";

interface Props {
  open: boolean;
  editing: User | null;
  saving: boolean;
  selectedRole: UserRole;
  branches: Branch[];
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: {
    full_name: string;
    email?: string;
    password?: string;
    role: UserRole;
    branch_id?: string | null;
  }) => void;
  onRoleChange: (role: UserRole) => void;
}

export function UserModal({ open, editing, saving, selectedRole, branches, form, onClose, onSubmit, onRoleChange }: Props) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const roleOptions = getRoleOptions(t);
  return (
    <Modal
      title={editing ? t("editTitle") : t("createTitle")}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item
          label={t("fullNameLabel")}
          name="full_name"
          rules={[{ required: true, message: t("fullNameRequired") }]}
        >
          <Input placeholder={t("fullNamePlaceholder")} />
        </Form.Item>

        {!editing && (
          <>
            <Form.Item
              label={t("emailLabel")}
              name="email"
              rules={[
                { required: true, message: t("emailRequired") },
                { type: "email", message: t("emailInvalid") },
              ]}
            >
              <Input placeholder={t("emailPlaceholder")} />
            </Form.Item>
            <Form.Item
              label={t("passwordLabel")}
              name="password"
              rules={[
                { required: true, message: t("passwordRequired") },
                { min: 6, message: t("passwordMin") },
              ]}
            >
              <Input.Password placeholder={t("passwordMin")} />
            </Form.Item>
          </>
        )}

        <Form.Item
          label={t("roleLabel")}
          name="role"
          rules={[{ required: true, message: t("roleRequired") }]}
        >
          <Select options={roleOptions} onChange={onRoleChange} />
        </Form.Item>

        <Form.Item
          label={t("branchLabel")}
          name="branch_id"
          rules={[{
            required: selectedRole === "cajero" || selectedRole === "cocinero",
            message: t("branchRequired"),
          }]}
        >
          <Select
            disabled={selectedRole === "admin"}
            placeholder={t("branchPlaceholder")}
            allowClear
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Form.Item>

        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>{tc("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? t("saveChanges") : t("createUser")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
