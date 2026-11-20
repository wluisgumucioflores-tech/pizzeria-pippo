"use client";

import { useEffect, useState } from "react";
import { Modal, InputNumber, Select, Input, Alert, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { CashExpenseCategory } from "../types/cashbox.types";

const { Text } = Typography;
const { TextArea } = Input;

const CATEGORIES: CashExpenseCategory[] = ["insumos", "mantenimiento", "transporte", "otro"];

interface Props {
  open: boolean;
  saving: boolean;
  error: string | null;
  onConfirm: (amount: number, category: CashExpenseCategory, note: string) => void;
  onClose: () => void;
}

export function RegisterExpenseModal({ open, saving, error, onConfirm, onClose }: Props) {
  // null, no 0: con 0 el campo arranca con un valor real y tipear 5 deja "05".
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<CashExpenseCategory>("insumos");
  const [note, setNote] = useState("");
  const t = useTranslations("cashbox.expenseModal");
  const tc = useTranslations("common");

  // Se limpia al abrir, no al cerrar: guardar un gasto cierra el modal desde
  // el hook (sin pasar por handleClose), y el gasto anterior quedaba cargado
  // para el siguiente.
  useEffect(() => {
    if (!open) return;
    setAmount(null);
    setCategory("insumos");
    setNote("");
  }, [open]);

  const categoryOptions = CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) }));

  const handleConfirm = () => {
    if (!amount) return;
    onConfirm(amount, category, note);
  };

  return (
    <Modal
      centered
      open={open}
      title={t("title")}
      okText={t("confirm")}
      cancelText={tc("cancel")}
      okButtonProps={{ loading: saving, disabled: !amount || amount <= 0 }}
      onOk={handleConfirm}
      onCancel={onClose}
      destroyOnClose
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Text style={{ display: "block", marginBottom: 8 }}>{t("amountLabel")}</Text>
      <InputNumber
        prefix="Bs"
        min={0.01}
        value={amount}
        placeholder="0.00"
        onChange={setAmount}
        style={{ width: "100%", marginBottom: 16 }}
        autoFocus
      />

      <Text style={{ display: "block", marginBottom: 8 }}>{t("categoryLabel")}</Text>
      <Select
        value={category}
        onChange={setCategory}
        options={categoryOptions}
        style={{ width: "100%", marginBottom: 16 }}
      />

      <Text style={{ display: "block", marginBottom: 8 }}>{t("noteLabel")}</Text>
      <TextArea
        placeholder={t("notePlaceholder")}
        maxLength={200}
        showCount
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  );
}
