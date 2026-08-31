"use client";

import { Modal, Form, Input, Button } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";

interface Props {
  open: boolean;
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { currentPassword: string; newPassword: string }) => void;
}

export function ChangePasswordModal({ open, saving, form, onClose, onSubmit }: Props) {
  const t = useTranslations("account");
  const tc = useTranslations("common");

  return (
    <Modal title={t("changePasswordTitle")} open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item
          label={t("currentPasswordLabel")}
          name="currentPassword"
          rules={[{ required: true, message: t("currentPasswordRequired") }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>

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
            {t("save")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
