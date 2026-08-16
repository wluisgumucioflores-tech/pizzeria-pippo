"use client";

import { useState } from "react";
import { Modal, Button, Checkbox, Input, Typography } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { PAYMENT_PROVIDERS } from "@pippo/shared";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { OptionCard } from "./OptionCard";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import type { PaymentMethod, SplitPayment } from "../types/pos.types";

const { Text } = Typography;

// Only one online provider exists today, so the checkbox is hardcoded to it —
// once a second provider (e.g. a payment gateway) exists, this becomes a picker.
const ONLINE_PROVIDER = "pedidos_ya" as const;

type OrderType = "dine_in" | "takeaway" | "delivery" | "pedidos_ya";

interface Props {
  open: boolean;
  total: number;
  enableTableNumber: boolean;
  onClose: () => void;
  onConfirm: (
    orderType: OrderType,
    paymentMethod: PaymentMethod,
    paymentProvider: string | null,
    payments: SplitPayment[] | null,
    notes: string | null,
    tableNumber: string | null,
  ) => void;
}

export function PaymentModal({ open, total, enableTableNumber, onClose, onConfirm }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("pos");
  const tm = useTranslations("pos.paymentModal");
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [deferred, setDeferred] = useState(false);
  const [onlinePayment, setOnlinePayment] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [tableNumber, setTableNumber] = useState("");

  const qrAmount = Math.round((total - cashAmount) * 100) / 100;

  const reset = () => {
    setOrderType(null);
    setPaymentMethod(null);
    setDeferred(false);
    setOnlinePayment(false);
    setCashAmount(0);
    setNotes("");
    setTableNumber("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleToggleOnlinePayment = (checked: boolean) => {
    setOnlinePayment(checked);
    // Fase 7 (docs/features/mesero-y-mejoras-pos/) — antes esto forzaba
    // order_type "takeaway", chocando con el order_type real "pedidos_ya"
    // que existe desde la Fase 0. Ahora quedan atados: tildar este check es
    // la única forma de crear un pedido pedidos_ya desde POS, así
    // order_type y payment_provider nunca quedan desincronizados.
    setOrderType(checked ? "pedidos_ya" : null);
    setPaymentMethod(null);
    setDeferred(false);
  };

  const handleSelectMixto = () => {
    setDeferred(false);
    if (paymentMethod === "mixto") {
      setPaymentMethod(null);
      return;
    }
    setPaymentMethod("mixto");
    setCashAmount(Math.round((total / 2) * 100) / 100);
  };

  const handleSelectPorCobrar = () => {
    if (deferred) {
      setDeferred(false);
      return;
    }
    setDeferred(true);
    setPaymentMethod(null);
  };

  const mixtoValid = paymentMethod !== "mixto" || (cashAmount > 0 && qrAmount > 0);

  const handleConfirm = () => {
    if (!orderType || !mixtoValid) return;
    const payments: SplitPayment[] | null =
      paymentMethod === "mixto"
        ? [
            { method: "efectivo", amount: cashAmount },
            { method: "qr", amount: qrAmount },
          ]
        : null;
    onConfirm(orderType, onlinePayment ? "online" : paymentMethod, onlinePayment ? ONLINE_PROVIDER : null, payments, notes.trim() || null, tableNumber.trim() || null);
    reset();
  };

  const totalBlock = (
    <div>
      <Text type="secondary" className="text-xs block" style={{ letterSpacing: 1 }}>{tm("orderTotal")}</Text>
      <Text strong className="!text-orange-700" style={{ fontSize: 34, lineHeight: 1.2 }}>Bs {total.toFixed(2)}</Text>
    </div>
  );

  const onlineShortcut = (
    <div className="flex items-start gap-2.5 bg-blue-50 rounded-lg px-3 py-2">
      <Checkbox checked={onlinePayment} onChange={(e) => handleToggleOnlinePayment(e.target.checked)} className="mt-0.5" />
      <div>
        <Text strong className="block text-sm">
          {tm("onlineOrder", { provider: PAYMENT_PROVIDERS[ONLINE_PROVIDER].label })}
        </Text>
        <Text type="secondary" className="text-xs block">
          {tm("onlineHint")}
        </Text>
      </div>
    </div>
  );

  const orderTypeSection = (
    <div style={onlinePayment ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{ width: 4, height: 16, background: "#ea580c", borderRadius: 2 }} />
        <Text strong>{tm("howIsOrder")} <Text type="danger">*</Text></Text>
      </div>
      <div className="flex gap-3">
        <OptionCard
          selected={orderType === "dine_in"}
          emoji="🍽️"
          label={t("orderType.dineIn")}
          accent="orange"
          onClick={() => setOrderType("dine_in")}
        />
        <OptionCard
          selected={orderType === "takeaway"}
          emoji="🥡"
          label={t("orderType.takeaway")}
          accent="orange"
          onClick={() => setOrderType("takeaway")}
        />
        <OptionCard
          selected={orderType === "delivery"}
          emoji="🛵"
          label={t("orderType.delivery")}
          accent="orange"
          onClick={() => setOrderType("delivery")}
        />
      </div>
      {!orderType && (
        <Text type="secondary" className="text-xs mt-1 block">{tm("selectToContinue")}</Text>
      )}
      {enableTableNumber && orderType === "dine_in" && (
        <Input
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder={tm("tableNumberPlaceholder")}
          className="mt-2"
        />
      )}
    </div>
  );

  const paymentMethodSection = (
    <PaymentMethodSelector
      disabled={onlinePayment}
      paymentMethod={paymentMethod}
      deferred={deferred}
      cashAmount={cashAmount}
      qrAmount={qrAmount}
      total={total}
      mixtoValid={mixtoValid}
      onSelectCash={() => { setDeferred(false); setPaymentMethod(paymentMethod === "efectivo" ? null : "efectivo"); }}
      onSelectQr={() => { setDeferred(false); setPaymentMethod(paymentMethod === "qr" ? null : "qr"); }}
      onSelectMixto={handleSelectMixto}
      onSelectDeferred={handleSelectPorCobrar}
      onCashAmountChange={setCashAmount}
    />
  );

  const notesSection = (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 4, height: 16, background: "#9ca3af", borderRadius: 2 }} />
          <Text strong>{tm("note")}</Text>
        </div>
        <Text type="secondary" className="text-xs">{t("optional")}</Text>
      </div>
      <Input.TextArea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={tm("notePlaceholder")}
        maxLength={300}
        rows={2}
        showCount
      />
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-6">
          <span>{tm("title")}</span>
          <span
            className="text-xs font-normal"
            style={{ background: "#fff7ed", color: "#ea580c", borderRadius: 999, padding: "2px 10px" }}
          >
            {tm("step1")}
          </span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={isMobile ? 420 : 720}
    >
      {isMobile ? (
        <div className="flex flex-col gap-3 mt-3">
          <div className="bg-orange-50 rounded-lg px-4 py-3">{totalBlock}</div>
          {onlineShortcut}
          {orderTypeSection}
          {paymentMethodSection}
          {notesSection}
        </div>
      ) : (
        <div className="flex gap-5 mt-3">
          <div className="flex flex-col gap-3" style={{ width: 200, flexShrink: 0, borderRight: "1px solid #e5e7eb", paddingRight: 20 }}>
            {totalBlock}
            {onlineShortcut}
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {orderTypeSection}
            {paymentMethodSection}
            {notesSection}
          </div>
        </div>
      )}

      <Button
        type="primary"
        size="large"
        block
        disabled={!orderType || !mixtoValid}
        onClick={handleConfirm}
        style={{
          marginTop: 16,
          ...(orderType
            ? { height: 48, fontSize: 16, background: "#ea580c", borderColor: "#ea580c" }
            : { height: 48, fontSize: 16 }),
        }}
      >
        {t("continueAction")} <ArrowRightOutlined />
      </Button>
    </Modal>
  );
}
