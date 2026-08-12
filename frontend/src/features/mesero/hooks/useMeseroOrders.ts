"use client";

import { useCallback, useEffect, useState } from "react";
import { PosService } from "@/features/pos/services/pos.service";
import { notifyOrderReady, unlockAudioOnFirstInteraction } from "@/lib/notify";
import { useNewIdAlert } from "@/lib/useNewIdAlert";
import type { DayOrder } from "@/features/pos/types/pos.types";

export function useMeseroOrders(branchId: string | undefined, waiterName: string | null) {
  const [orders, setOrders] = useState<DayOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const data = await PosService.getDayOrders(branchId);
    setOrders(data);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    unlockAudioOnFirstInteraction();
  }, []);

  useEffect(() => {
    if (!branchId) return;
    const subscription = PosService.subscribeToKitchenStatus(
      branchId,
      ({ new: updated }) => {
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, kitchen_status: updated.kitchen_status } : o)));
      },
      fetchOrders,
      setConnected
    );
    return () => PosService.unsubscribe(subscription);
  }, [branchId, fetchOrders]);

  const myOrders = waiterName ? orders.filter((o) => o.waiter_name === waiterName) : [];

  useNewIdAlert(
    myOrders.filter((o) => o.kitchen_status === "ready").map((o) => o.id),
    notifyOrderReady
  );

  return { myOrders, loading, refresh: fetchOrders, connected };
}
