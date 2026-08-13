"use client";

import { useState } from "react";
import { Modal, Button, InputNumber, Typography } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { OptionCard } from "./OptionCard";
import type { DayOrder, PaymentMethod, SplitPayment } from "../types/pos.types";

const { Text } = Typography;

interface Props {
  order: DayOrder | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, payments: SplitPayment[] | null) => void;
}

// Fase 4 (docs/features/mesero-y-mejoras-pos/) — cobro diferido. Versión
// reducida de PaymentModal: la orden ya existe (mesa/mesero/items ya están
// fijos), acá solo se elige CÓMO se cobró.
export function CollectPaymentModal({ order, submitting, onClose, onConfirm }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [cashAmount, setCashAmount] = useState(0);

  if (!order) return null;
  const total = Number(order.total);
  const qrAmount = Math.round((total - cashAmount) * 100) / 100;
  const mixtoValid = paymentMethod !== "mixto" || (cashAmount > 0 && qrAmount > 0);

  const reset = () => {
    setPaymentMethod(null);
    setCashAmount(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectMixto = () => {
    if (paymentMethod === "mixto") {
      setPaymentMethod(null);
      return;
    }
    setPaymentMethod("mixto");
    setCashAmount(Math.round((total / 2) * 100) / 100);
  };

  const handleConfirm = () => {
    if (!paymentMethod || !mixtoValid) return;
    const payments: SplitPayment[] | null =
      paymentMethod === "mixto"
        ? [
            { method: "efectivo", amount: cashAmount },
            { method: "qr", amount: qrAmount },
          ]
        : null;
    onConfirm(paymentMethod, payments);
  };

  return (
    <Modal title="Cobrar pedido" open={!!order} onCancel={handleClose} footer={null} width={420}>
      <div className="flex flex-col gap-3 mt-3">
        <div className="bg-orange-50 rounded-lg px-4 py-3">
          <Text type="secondary" className="text-xs block" style={{ letterSpacing: 1 }}>
            #{String(order.daily_number).padStart(2, "0")} {order.table_number ? `— Mesa ${order.table_number}` : ""}
          </Text>
          <Text strong className="!text-orange-700" style={{ fontSize: 34, lineHeight: 1.2 }}>Bs {total.toFixed(2)}</Text>
        </div>

        <div className="flex gap-3">
          <OptionCard selected={paymentMethod === "efectivo"} emoji="💵" label="Efectivo" accent="blue" onClick={() => setPaymentMethod(paymentMethod === "efectivo" ? null : "efectivo")} />
          <OptionCard selected={paymentMethod === "qr"} emoji="📱" label="QR" accent="blue" onClick={() => setPaymentMethod(paymentMethod === "qr" ? null : "qr")} />
          <OptionCard selected={paymentMethod === "mixto"} emoji="🔀" label="Mixto" accent="blue" onClick={handleSelectMixto} />
        </div>

        {paymentMethod === "mixto" && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <Text type="secondary" className="text-xs block mb-1">Efectivo recibido</Text>
                <InputNumber
                  value={cashAmount}
                  min={0}
                  max={total}
                  style={{ width: "100%" }}
                  onChange={(value) => setCashAmount(Math.min(total, Math.max(0, value ?? 0)))}
                />
              </div>
              <div className="flex-1">
                <Text type="secondary" className="text-xs block mb-1">Resto en QR</Text>
                <div style={{ height: 32, display: "flex", alignItems: "center" }}>
                  <Text strong className="text-base">Bs {qrAmount.toFixed(2)}</Text>
                </div>
              </div>
            </div>
            {!mixtoValid && <Text type="danger" className="text-xs mt-2 block">Ambos montos deben ser mayores a 0</Text>}
          </div>
        )}

        <Button
          type="primary"
          size="large"
          block
          disabled={!paymentMethod || !mixtoValid}
          loading={submitting}
          onClick={handleConfirm}
          style={{ height: 48, fontSize: 16, ...(paymentMethod ? { background: "#ea580c", borderColor: "#ea580c" } : {}) }}
        >
          Cobrar <ArrowRightOutlined />
        </Button>
      </div>
    </Modal>
  );
}
