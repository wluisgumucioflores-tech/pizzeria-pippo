"use client";

import { useEffect, useState } from "react";
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
  // null, no 0: con 0 el campo arranca con un valor real y tipear 5 deja "05".
  const [amount, setAmount] = useState<number | null>(null);
  const t = useTranslations("cashbox.openModal");
  const tc = useTranslations("common");

  useEffect(() => {
    if (open) setAmount(null);
  }, [open]);

  // Abrir con la caja vacía es válido, así que no haber tipeado nada vale 0.
  const handleConfirm = () => onConfirm(amount ?? 0);

  return (
    <Modal
      centered
      open={open}
      title={t("title")}
      okText={t("confirm")}
      cancelText={tc("cancel")}
      okButtonProps={{ loading: saving }}
      onOk={handleConfirm}
      onCancel={onClose}
      destroyOnClose
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Text style={{ display: "block", marginBottom: 8 }}>{t("amountLabel")}</Text>
      <InputNumber
        prefix="Bs"
        min={0}
        value={amount}
        placeholder="0.00"
        onChange={setAmount}
        style={{ width: "100%" }}
        autoFocus
      />
    </Modal>
  );
}
