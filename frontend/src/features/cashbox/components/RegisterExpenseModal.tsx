"use client";

import { useState } from "react";
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
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<CashExpenseCategory>("insumos");
  const [note, setNote] = useState("");
  const t = useTranslations("cashbox.expenseModal");
  const tc = useTranslations("common");

  const categoryOptions = CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) }));

  const handleConfirm = () => onConfirm(amount, category, note);
  const handleClose = () => {
    setAmount(0);
    setCategory("insumos");
    setNote("");
    onClose();
  };

  return (
    <Modal
      centered
      open={open}
      title={t("title")}
      okText={t("confirm")}
      cancelText={tc("cancel")}
      okButtonProps={{ loading: saving, disabled: amount <= 0 }}
      onOk={handleConfirm}
      onCancel={handleClose}
      destroyOnClose
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Text style={{ display: "block", marginBottom: 8 }}>{t("amountLabel")}</Text>
      <InputNumber
        prefix="Bs"
        min={0.01}
        value={amount}
        onChange={(v) => setAmount(v ?? 0)}
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
