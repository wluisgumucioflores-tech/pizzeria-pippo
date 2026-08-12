"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { notifyOrderReady, unlockAudioOnFirstInteraction } from "@/lib/notify";
import { useNewIdAlert } from "@/lib/useNewIdAlert";
import { PosService } from "../services/pos.service";
import type { DayOrder, PaymentMethod, SplitPayment } from "../types/pos.types";

export function useDayOrders(branchId: string | undefined, showOrders: boolean) {
  const [dayOrders, setDayOrders] = useState<DayOrder[]>([]);
  const [markingReady, setMarkingReady] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<DayOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [payModal, setPayModal] = useState<DayOrder | null>(null);
  const [paying, setPaying] = useState(false);
  const [connected, setConnected] = useState(true);

  const fetchDayOrders = useCallback(async (bid: string) => {
    const data = await PosService.getDayOrders(bid);
    setDayOrders(data);
  }, []);

  useEffect(() => {
    unlockAudioOnFirstInteraction();
  }, []);

  useEffect(() => {
    if (showOrders && branchId) fetchDayOrders(branchId);
  }, [showOrders, branchId, fetchDayOrders]);

  // Realtime: kitchen_status updates + new orders (ej. creados por un mesero)
  useEffect(() => {
    if (!branchId) return;
    const channel = PosService.subscribeToKitchenStatus(
      branchId,
      (payload) => {
        setDayOrders((prev) =>
          prev.map((o) => o.id === payload.new.id
            ? {
                ...o,
                kitchen_status: payload.new.kitchen_status,
                ...(payload.new.payment_method !== undefined ? { payment_method: payload.new.payment_method as PaymentMethod } : {}),
              }
            : o)
        );
      },
      () => { fetchDayOrders(branchId); },
      setConnected
    );
    return () => { PosService.unsubscribe(channel); };
  }, [branchId, fetchDayOrders]);

  useNewIdAlert(
    dayOrders.filter((o) => o.kitchen_status === "ready" && !o.cancelled_at).map((o) => o.id),
    notifyOrderReady
  );

  const handleMarkReady = async (orderId: string) => {
    setMarkingReady(orderId);
    await PosService.markOrderReady(orderId);
    setDayOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, kitchen_status: "ready" } : o)
    );
    setMarkingReady(null);
  };

  const openCancelModal = (order: DayOrder) => setCancelModal(order);
  const closeCancelModal = () => setCancelModal(null);

  const handleCancelOrder = async (orderId: string, reason: string) => {
    setCancelling(true);
    const result = await PosService.cancelOrder(orderId, reason);
    setCancelling(false);
    if (result.ok) {
      setDayOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, cancelled_at: new Date().toISOString() } : o)
      );
      setCancelModal(null);
      message.success("Orden anulada correctamente. Stock restaurado.");
    } else {
      message.error(result.error ?? "Error al anular la orden");
    }
  };

  const openPayModal = (order: DayOrder) => setPayModal(order);
  const closePayModal = () => setPayModal(null);

  const handlePayOrder = async (paymentMethod: PaymentMethod, payments: SplitPayment[] | null) => {
    if (!payModal) return;
    setPaying(true);
    const result = await PosService.payOrder(payModal.id, paymentMethod, null, payments);
    setPaying(false);
    if (result.ok) {
      setDayOrders((prev) =>
        prev.map((o) => o.id === payModal.id ? { ...o, payment_method: payments ? "mixto" : paymentMethod } : o)
      );
      setPayModal(null);
      message.success("Pedido cobrado correctamente.");
    } else {
      message.error(result.error ?? "Error al cobrar el pedido");
    }
  };

  return {
    dayOrders, markingReady, fetchDayOrders, handleMarkReady,
    cancelModal, cancelling, openCancelModal, closeCancelModal, handleCancelOrder,
    payModal, paying, openPayModal, closePayModal, handlePayOrder,
    connected,
  };
}
