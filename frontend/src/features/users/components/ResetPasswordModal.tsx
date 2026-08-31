"use client";

import { Modal, Form, Input, Button } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import type { User } from "../types/user.types";

interface Props {
  open: boolean;
  user: User | null;
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { newPassword: string }) => void;
}

export function ResetPasswordModal({ open, user, saving, form, onClose, onSubmit }: Props) {
  const t = useTranslations("users");
  const tc = useTranslations("common");

  return (
    <Modal
      title={t("resetPasswordTitle", { name: user?.full_name ?? "" })}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item
          label={t("newPasswordLabel")}
          name="newPassword"
          rules={[
            { required: true, message: t("newPasswordRequired") },
            { min: 6, message: t("newPasswordMin") },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          label={t("confirmPasswordLabel")}
          name="confirmPassword"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: t("confirmPasswordRequired") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                return Promise.reject(new Error(t("confirmPasswordMismatch")));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>{tc("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {t("resetPasswordSave")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
