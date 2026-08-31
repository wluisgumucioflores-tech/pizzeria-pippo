"use client";

import { useState } from "react";
import { Form, notification } from "antd";
import { useTranslations } from "next-intl";
import { AccountService } from "../services/account.service";

export function useChangePassword() {
  const t = useTranslations("account.toasts");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const openModal = () => setOpen(true);

  const closeModal = () => {
    setOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values: { currentPassword: string; newPassword: string }) => {
    setSaving(true);
    const result = await AccountService.changePassword(values.currentPassword, values.newPassword);

    if (result.ok) {
      closeModal();
      notification.success({ message: t("updated") });
    } else {
      notification.error({ message: result.error ?? t("updateError") });
    }
    setSaving(false);
  };

  return { open, saving, form, openModal, closeModal, handleSubmit };
}
