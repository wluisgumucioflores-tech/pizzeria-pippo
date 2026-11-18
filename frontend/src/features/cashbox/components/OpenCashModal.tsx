"use client";

import { useState } from "react";
import { Modal, InputNumber, Alert, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface Props {
  open: boolean;
  saving: boolean;
  error: string | null;
  onConfirm: (openingAmount: number) => void;
  onClose: () => void;
}

export function OpenCashModal({ open, saving, error, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState<number>(0);
  const t = useTranslations("cashbox.openModal");
  const tc = useTranslations("common");

  const handleConfirm = () => onConfirm(amount);
  const handleClose = () => {
    setAmount(0);
    onClose();
  };

  return (
    <Modal
      centered
      open={open}
      title={t("title")}
      okText={t("confirm")}
      cancelText={tc("cancel")}
      okButtonProps={{ loading: saving }}
      onOk={handleConfirm}
      onCancel={handleClose}
      destroyOnClose
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Text style={{ display: "block", marginBottom: 8 }}>{t("amountLabel")}</Text>
      <InputNumber
        prefix="Bs"
        min={0}
        value={amount}
        onChange={(v) => setAmount(v ?? 0)}
        style={{ width: "100%" }}
        autoFocus
      />
    </Modal>
  );
}
