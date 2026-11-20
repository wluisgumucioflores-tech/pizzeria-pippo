"use client";

import { useEffect, useState } from "react";
import { Modal, InputNumber, Alert, Typography, Divider } from "antd";
import { useTranslations } from "next-intl";
import type { CashSession } from "../types/cashbox.types";

const { Text } = Typography;

interface Props {
  open: boolean;
  saving: boolean;
  error: string | null;
  session: CashSession | null;
  onConfirm: (countedAmount: number) => void;
  onClose: () => void;
}

export function CloseCashModal({ open, saving, error, session, onConfirm, onClose }: Props) {
  // null, no 0: con 0 el campo arranca con un valor real y tipear 5 deja "05".
  const [counted, setCounted] = useState<number | null>(null);
  const t = useTranslations("cashbox.closeModal");
  const tc = useTranslations("common");

  useEffect(() => {
    if (open) setCounted(null);
  }, [open]);

  const handleConfirm = () => {
    if (counted === null) return;
    onConfirm(counted);
  };

  if (!session) return null;

  // Sin monto contado todavía no hay diferencia que mostrar: con 0 por
  // defecto el modal abría gritando "faltante" antes de que el cajero
  // tocara nada.
  const diff = counted === null ? null : counted - session.expected_amount;
  const diffDisplay =
    diff === null
      ? null
      : diff < 0
        ? { text: `− Bs ${Math.abs(diff).toFixed(2)} · ${t("shortage")}`, color: "#dc2626" }
        : diff > 0
          ? { text: `+ Bs ${diff.toFixed(2)} · ${t("surplus")}`, color: "#d97706" }
          : { text: `Bs 0,00 · ${t("balanced")}`, color: "#16a34a" };

  return (
    <Modal
      centered
      open={open}
      title={t("title")}
      okText={t("confirm")}
      cancelText={tc("cancel")}
      okButtonProps={{ loading: saving, danger: true, disabled: counted === null }}
      onOk={handleConfirm}
      onCancel={onClose}
      destroyOnClose
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
        <Text type="secondary">{t("opening")}</Text>
        <Text>Bs {session.opening_amount.toFixed(2)}</Text>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
        <Text type="secondary">{t("cashSales")}</Text>
        <Text>Bs {session.cash_sales.toFixed(2)}</Text>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
        <Text type="secondary">{t("expenses")}</Text>
        <Text>− Bs {session.expenses_total.toFixed(2)}</Text>
      </div>
      <Divider style={{ margin: "8px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
        <Text strong>{t("expected")}</Text>
        <Text strong>Bs {session.expected_amount.toFixed(2)}</Text>
      </div>

      <Text style={{ display: "block", margin: "16px 0 8px" }}>{t("countedLabel")}</Text>
      <InputNumber
        prefix="Bs"
        min={0}
        value={counted}
        placeholder="0.00"
        onChange={setCounted}
        style={{ width: "100%", marginBottom: 16 }}
        autoFocus
      />

      {diffDisplay && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 6,
            background: `${diffDisplay.color}1a`,
            color: diffDisplay.color,
            fontWeight: 600,
          }}
        >
          <span>{t("difference")}</span>
          <span>{diffDisplay.text}</span>
        </div>
      )}
    </Modal>
  );
}
