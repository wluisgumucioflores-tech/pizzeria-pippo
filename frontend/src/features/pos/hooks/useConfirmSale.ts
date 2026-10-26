"use client";

import { useState } from "react";
import { message } from "antd";
import { generateUUID } from "@/lib/uuid";
import { cashDueFor, computeChange } from "@/lib/cash-change";
import { PosService } from "../services/pos.service";
import { OfflineSalesService } from "../services/offline-sales.service";
import type { useOfflineSales } from "./useOfflineSales";
import type { usePosCart } from "./usePosCart";
import type { TicketData, OrderType, PosTab, PaymentMethod, SplitPayment } from "../types/pos.types";

interface Params {
  branchId: string;
  cart: ReturnType<typeof usePosCart>;
  broadcast: (event: string) => void;
  applyStockUpdates: (updates: { variant_id: string; quantity: number }[]) => void;
  decrementLocalStock: (sold: { variant_id: string; qty_physical: number }[]) => void;
  offlineSales: ReturnType<typeof useOfflineSales>;
  offlineEnabled: boolean;
  setActiveTab: (tab: PosTab) => void;
}

/**
 * Owns everything about closing a sale: the payment selection carried between
 * the two modal steps, and the two ways a sale can reach the server — straight
 * POST, or queued locally for the background worker when the business has
 * offline sales enabled.
 */
export function useConfirmSale({
  branchId, cart, broadcast, applyStockUpdates, decrementLocalStock,
  offlineSales, offlineEnabled, setActiveTab,
}: Params) {
  const [paymentModal, setPaymentModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null);
  const [payments, setPayments] = useState<SplitPayment[] | null>(null);
  const [saleNotes, setSaleNotes] = useState<string | null>(null);
  const [saleTableNumber, setSaleTableNumber] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const handlePaymentConfirm = (
    orderType: OrderType,
    method: PaymentMethod,
    provider: string | null,
    splitPayments: SplitPayment[] | null,
    notes: string | null,
    tableNumber: string | null,
  ) => {
    setPaymentMethod(method);
    setPaymentProvider(provider);
    setPayments(splitPayments);
    setSaleNotes(notes);
    setSaleTableNumber(tableNumber);
    cart.setOrderType(orderType);
    setIdempotencyKey(generateUUID());
    setPaymentModal(false);
    setConfirmModal(true);
  };

  const handleConfirmSale = async (cashReceived: number | null = null) => {
    if (!branchId) {
      message.error("No hay sucursal seleccionada.");
      return;
    }
    const orderType = cart.orderType;
    if (!orderType) {
      message.error("Seleccioná el tipo de pedido antes de confirmar.");
      return;
    }

    // Closes the sale on screen. Shared by both paths so the cashier ends in
    // exactly the same state whether the sale went out or was queued.
    const finishSale = (orderId: string, dailyNumber: number) => {
      broadcast("ORDER_COMPLETE");
      cart.suppressNextClear();
      setConfirmModal(false);
      setPaymentMethod(null);
      setPaymentProvider(null);
      setPayments(null);
      setIdempotencyKey(null);
      setActiveTab("sale");
      const cashDue = cashDueFor(paymentMethod, cart.total, payments);
      setTicket({
        orderId, dailyNumber, items: cart.discountedCart, total: cart.total,
        paymentMethod, paymentProvider, payments, orderType,
        notes: saleNotes, tableNumber: saleTableNumber, cashReceived,
        changeGiven: cashDue === null ? null : computeChange(cashReceived, cashDue),
      });
      setSaleNotes(null);
      setSaleTableNumber(null);
      cart.clearCart();
    };

    const key = idempotencyKey ?? generateUUID();
    const payloadInput = {
      branchId, discountedCart: cart.discountedCart, total: cart.total,
      paymentMethod, paymentProvider, orderType,
      idempotencyKey: key, payments: payments ?? undefined,
      notes: saleNotes, tableNumber: saleTableNumber,
    };

    // Offline-first path: written to IndexedDB and the ticket is raised right
    // away, so the cashier never waits for the network. The background worker
    // pushes it when the connection allows.
    if (offlineEnabled) {
      const dailyNumber = await offlineSales.takeTicketNumber();
      if (dailyNumber !== null) {
        await OfflineSalesService.enqueue({
          idempotencyKey: key,
          branchId,
          dailyNumber,
          payload: PosService.buildOrderPayload({ ...payloadInput, dailyNumber }),
          createdAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          status: "pending",
          lastError: null,
        });
        decrementLocalStock(cart.discountedCart.map((i) => ({ variant_id: i.variant_id, qty_physical: i.qty_physical })));
        finishSale(`offline:${key}`, dailyNumber);
        void offlineSales.syncNow();
        return;
      }
      // Reserved range spent and no new one obtainable (that needs network),
      // so fall through to selling online — the only correct option left.
      message.warning("No hay números de pedido reservados. Enviando la venta online.", 4);
    }

    setConfirmLoading(true);
    try {
      const result = await PosService.confirmSale(branchId, cart.discountedCart, cart.total, paymentMethod, paymentProvider, orderType, undefined, key, payments ?? undefined, saleNotes, saleTableNumber);

      if (result.ok) {
        finishSale(result.order_id!, result.daily_number!);
        // No refetch of the day's orders here on purpose — the order:created
        // WebSocket event already inserts this order (deduped by id), and the
        // old fetchDayOrders() re-downloaded the whole day after every sale.
        if (result.stock_updates?.length) applyStockUpdates(result.stock_updates);
      } else {
        message.error(`Error al confirmar venta: ${result.error}`, 5);
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  return {
    paymentModal, setPaymentModal,
    confirmModal, setConfirmModal,
    paymentMethod, setPaymentMethod,
    paymentProvider, setPaymentProvider,
    payments,
    ticket, setTicket,
    confirmLoading,
    handlePaymentConfirm, handleConfirmSale,
  };
}
