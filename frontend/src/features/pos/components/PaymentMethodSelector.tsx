"use client";

import { InputNumber, Typography } from "antd";
import { useTranslations } from "next-intl";
import { OptionCard } from "./OptionCard";
import type { PaymentMethod } from "../types/pos.types";

const { Text } = Typography;

interface Props {
  disabled?: boolean;
  paymentMethod: PaymentMethod;
  deferred: boolean;
  cashAmount: number;
  qrAmount: number;
  total: number;
  mixtoValid: boolean;
  onSelectCash: () => void;
  onSelectQr: () => void;
  onSelectMixto: () => void;
  onSelectDeferred: () => void;
  onCashAmountChange: (value: number) => void;
}

export function PaymentMethodSelector({
  disabled,
  paymentMethod,
  deferred,
  cashAmount,
  qrAmount,
  total,
  mixtoValid,
  onSelectCash,
  onSelectQr,
  onSelectMixto,
  onSelectDeferred,
  onCashAmountChange,
}: Props) {
  const t = useTranslations("pos");
  const tm = useTranslations("pos.paymentModal");

  return (
    <div style={disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 4, height: 16, background: "#2563eb", borderRadius: 2 }} />
          <Text strong>{tm("howDidPay")}</Text>
        </div>
        <Text type="secondary" className="text-xs">{t("optional")}</Text>
      </div>
      <div className="flex flex-wrap gap-3">
        <OptionCard selected={paymentMethod === "efectivo"} emoji="💵" label={t("paymentMethod.cash")} accent="blue" onClick={onSelectCash} />
        <OptionCard selected={paymentMethod === "qr"} emoji="📱" label={t("paymentMethod.qr")} accent="blue" onClick={onSelectQr} />
        <OptionCard selected={paymentMethod === "mixto"} emoji="🔀" label={t("paymentMethod.mixed")} accent="blue" onClick={onSelectMixto} />
        <OptionCard selected={deferred} emoji="🧾" label={t("paymentMethod.deferred")} accent="blue" onClick={onSelectDeferred} />
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
                onChange={(value) => onCashAmountChange(Math.min(total, Math.max(0, value ?? 0)))}
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
}
