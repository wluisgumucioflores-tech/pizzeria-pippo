"use client";

import { useState } from "react";
import { Modal, Button, Checkbox, InputNumber, Input, Typography } from "antd";
import { CheckCircleFilled, ArrowRightOutlined } from "@ant-design/icons";
import { PAYMENT_PROVIDERS } from "@pippo/shared";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { PaymentMethod, SplitPayment } from "../types/pos.types";

const { Text } = Typography;

// Only one online provider exists today, so the checkbox is hardcoded to it —
// once a second provider (e.g. a payment gateway) exists, this becomes a picker.
const ONLINE_PROVIDER = "pedidos_ya" as const;

type OrderType = "dine_in" | "takeaway";

interface Props {
  open: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (
    orderType: OrderType,
    paymentMethod: PaymentMethod,
    paymentProvider: string | null,
    payments: SplitPayment[] | null,
    notes: string | null,
  ) => void;
}

interface OptionCardProps {
  selected: boolean;
  emoji: string;
  label: string;
  accent: "orange" | "blue";
  onClick: () => void;
}

function OptionCard({ selected, emoji, label, accent, onClick }: OptionCardProps) {
  const colors =
    accent === "orange"
      ? { border: "#f97316", bg: "#fff7ed", text: "#ea580c", badge: "#ffedd5" }
      : { border: "#3b82f6", bg: "#eff6ff", text: "#2563eb", badge: "#dbeafe" };
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-4 px-3 text-center cursor-pointer relative"
      style={{
        border: selected ? `2px solid ${colors.border}` : "1px solid #e5e7eb",
        background: selected ? colors.bg : "#fff",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {selected && (
        <CheckCircleFilled
          style={{ position: "absolute", top: 8, right: 10, color: colors.text, fontSize: 18 }}
        />
      )}
      <div
        className="mx-auto flex items-center justify-center rounded-lg"
        style={{ width: 44, height: 44, background: colors.badge, fontSize: 22 }}
      >
        {emoji}
      </div>
      <div
        className="text-sm mt-2"
        style={{ color: selected ? colors.text : "#374151", fontWeight: selected ? 600 : 500 }}
      >
        {label}
      </div>
    </button>
  );
}

export function PaymentModal({ open, total, onClose, onConfirm }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("pos");
  const tm = useTranslations("pos.paymentModal");
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [onlinePayment, setOnlinePayment] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [notes, setNotes] = useState("");

  const qrAmount = Math.round((total - cashAmount) * 100) / 100;

  const reset = () => {
    setOrderType(null);
    setPaymentMethod(null);
    setOnlinePayment(false);
    setCashAmount(0);
    setNotes("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleToggleOnlinePayment = (checked: boolean) => {
    setOnlinePayment(checked);
    setOrderType(checked ? "takeaway" : null);
    setPaymentMethod(null);
  };

  const handleSelectMixto = () => {
    if (paymentMethod === "mixto") {
      setPaymentMethod(null);
      return;
    }
    setPaymentMethod("mixto");
    setCashAmount(Math.round((total / 2) * 100) / 100);
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
    onConfirm(orderType, onlinePayment ? "online" : paymentMethod, onlinePayment ? ONLINE_PROVIDER : null, payments, notes.trim() || null);
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
      </div>
      {!orderType && (
        <Text type="secondary" className="text-xs mt-1 block">{tm("selectToContinue")}</Text>
      )}
    </div>
  );

  const paymentMethodSection = (
    <div style={onlinePayment ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 4, height: 16, background: "#2563eb", borderRadius: 2 }} />
          <Text strong>{tm("howDidPay")}</Text>
        </div>
        <Text type="secondary" className="text-xs">{t("optional")}</Text>
      </div>
      <div className="flex gap-3">
        <OptionCard
          selected={paymentMethod === "efectivo"}
          emoji="💵"
          label={t("paymentMethod.cash")}
          accent="blue"
          onClick={() => setPaymentMethod(paymentMethod === "efectivo" ? null : "efectivo")}
        />
        <OptionCard
          selected={paymentMethod === "qr"}
          emoji="📱"
          label={t("paymentMethod.qr")}
          accent="blue"
          onClick={() => setPaymentMethod(paymentMethod === "qr" ? null : "qr")}
        />
        <OptionCard
          selected={paymentMethod === "mixto"}
          emoji="🔀"
          label={t("paymentMethod.mixed")}
          accent="blue"
          onClick={handleSelectMixto}
        />
      </div>
      <Text type="secondary" className="text-xs mt-1 block">{tm("toggleHint")}</Text>

      {paymentMethod === "mixto" && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Text type="secondary" className="text-xs block mb-1" style={{ letterSpacing: 0.5 }}>{tm("cashReceived")}</Text>
              <InputNumber
                value={cashAmount}
                min={0}
                max={total}
                style={{ width: "100%" }}
                onChange={(value) => setCashAmount(Math.min(total, Math.max(0, value ?? 0)))}
              />
            </div>
            <div className="flex-1">
              <Text type="secondary" className="text-xs block mb-1" style={{ letterSpacing: 0.5 }}>{tm("remainingQr")}</Text>
              <div style={{ height: 32, display: "flex", alignItems: "center" }}>
                <Text strong className="text-base">Bs {qrAmount.toFixed(2)}</Text>
              </div>
            </div>
          </div>
          {!mixtoValid && (
            <Text type="danger" className="text-xs mt-2 block">{tm("bothMustBeGreater")}</Text>
          )}
        </div>
      )}
    </div>
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
