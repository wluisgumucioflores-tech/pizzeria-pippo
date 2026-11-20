"use client";

import { useEffect, useState } from "react";
import { Modal, Button, Typography } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import {
  resolveDefaultOrderType,
  resolveDefaultPaymentMethod,
  type PosCheckoutConfig,
  type PosOrderTypeOption,
} from "@pippo/shared";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { cashDueFor } from "@/lib/cash-change";
import { useCashChange } from "../hooks/useCashChange";
import { CashChangeCalculator } from "./CashChangeCalculator";
import { OrderTypeSection } from "./OrderTypeSection";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { PedidosYaShortcut, ONLINE_PROVIDER } from "./PedidosYaShortcut";
import { SaleNotesField } from "./SaleNotesField";
import type { PaymentMethod, SplitPayment } from "../types/pos.types";

const { Text } = Typography;

type OrderType = PosOrderTypeOption | "pedidos_ya" | "online";

export interface ConfirmPaymentOptions {
  /** El negocio configuró cerrar la venta sin la pantalla de confirmación. */
  skipConfirm: boolean;
  /** Solo se completa en el cierre directo; si no, lo pide el paso 2. */
  cashReceived: number | null;
}

interface Props {
  open: boolean;
  total: number;
  checkout: PosCheckoutConfig;
  onClose: () => void;
  onConfirm: (
    orderType: OrderType,
    paymentMethod: PaymentMethod,
    paymentProvider: string | null,
    payments: SplitPayment[] | null,
    notes: string | null,
    tableNumber: string | null,
    options: ConfirmPaymentOptions,
  ) => void;
}

export function PaymentModal({ open, total, checkout, onClose, onConfirm }: Props) {
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

  const presetOrderType = resolveDefaultOrderType(checkout);
  const presetPaymentMethod = resolveDefaultPaymentMethod(checkout);
  const qrAmount = Math.round((total - cashAmount) * 100) / 100;

  // Las preselecciones se re-aplican en cada apertura (y si la config llega
  // después del primer render), no solo al montar: el modal vive montado
  // entre ventas, así que sin esto la segunda venta abriría con lo que dejó
  // la anterior.
  useEffect(() => {
    if (!open) return;
    setOrderType(presetOrderType);
    setPaymentMethod(presetPaymentMethod);
    setDeferred(false);
    setOnlinePayment(false);
    setCashAmount(0);
    setNotes("");
    setTableNumber("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetOrderType, presetPaymentMethod]);

  const handleClose = () => {
    onClose();
  };

  const handleToggleOnlinePayment = (checked: boolean) => {
    setOnlinePayment(checked);
    // Fase 7 (docs/features/mesero-y-mejoras-pos/) — tildar este check es la
    // única forma de crear un pedido pedidos_ya desde POS, así order_type y
    // payment_provider nunca quedan desincronizados.
    setOrderType(checked ? "pedidos_ya" : presetOrderType);
    setPaymentMethod(checked ? null : presetPaymentMethod);
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

  const payments: SplitPayment[] | null =
    paymentMethod === "mixto"
      ? [
          { method: "efectivo", amount: cashAmount },
          { method: "qr", amount: qrAmount },
        ]
      : null;

  // Con el paso 2 salteado la calculadora de vuelto vive acá: el negocio pidió
  // cerrar más rápido, no perder el vuelto.
  const cashDue = checkout.skip_confirm_step ? cashDueFor(paymentMethod, total, payments) : null;
  const cashChange = useCashChange(cashDue);

  const handleConfirm = () => {
    if (!orderType || !mixtoValid) return;
    onConfirm(
      orderType,
      onlinePayment ? "online" : paymentMethod,
      onlinePayment ? ONLINE_PROVIDER : null,
      payments,
      notes.trim() || null,
      tableNumber.trim() || null,
      { skipConfirm: checkout.skip_confirm_step, cashReceived: cashChange.received },
    );
  };

  const totalBlock = (
    <div>
      <Text type="secondary" className="text-xs block" style={{ letterSpacing: 1 }}>{tm("orderTotal")}</Text>
      <Text strong className="!text-orange-700" style={{ fontSize: 34, lineHeight: 1.2 }}>Bs {total.toFixed(2)}</Text>
    </div>
  );

  const onlineShortcut = checkout.enable_pedidos_ya && (
    <PedidosYaShortcut checked={onlinePayment} onChange={handleToggleOnlinePayment} />
  );

  const orderTypeSection = (
    <OrderTypeSection
      options={checkout.order_types}
      selected={orderType === "pedidos_ya" || orderType === "online" ? null : orderType}
      disabled={onlinePayment}
      enableTableNumber={checkout.enable_table_number}
      tableNumber={tableNumber}
      onSelect={setOrderType}
      onTableNumberChange={setTableNumber}
    />
  );

  const paymentMethodSection = checkout.payment_methods.length > 0 && (
    <PaymentMethodSelector
      options={checkout.payment_methods}
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

  const sections = (
    <>
      {orderTypeSection}
      {paymentMethodSection}
      {checkout.enable_notes && <SaleNotesField value={notes} onChange={setNotes} />}
      {cashDue !== null && (
        <CashChangeCalculator
          amountDue={cashDue}
          received={cashChange.received}
          change={cashChange.change}
          insufficient={cashChange.insufficient}
          suggestions={cashChange.suggestions}
          onReceivedChange={cashChange.setReceived}
        />
      )}
    </>
  );

  return (
    <Modal
      centered
      title={
        <div className="flex items-center justify-between pr-6">
          <span>{tm("title")}</span>
          <span
            className="text-xs font-normal"
            style={{ background: "#fff7ed", color: "#ea580c", borderRadius: 999, padding: "2px 10px" }}
          >
            {checkout.skip_confirm_step ? tm("singleStep") : tm("step1")}
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
          {sections}
        </div>
      ) : (
        <div className="flex gap-5 mt-3">
          <div className="flex flex-col gap-3" style={{ width: 200, flexShrink: 0, borderRight: "1px solid #e5e7eb", paddingRight: 20 }}>
            {totalBlock}
            {onlineShortcut}
          </div>
          <div className="flex-1 flex flex-col gap-3">{sections}</div>
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
          height: 48,
          fontSize: 16,
          ...(orderType ? { background: "#ea580c", borderColor: "#ea580c" } : {}),
        }}
      >
        {checkout.skip_confirm_step
          ? tm("chargeAction", { total: total.toFixed(2) })
          : <>{t("continueAction")} <ArrowRightOutlined /></>}
      </Button>
    </Modal>
  );
}
