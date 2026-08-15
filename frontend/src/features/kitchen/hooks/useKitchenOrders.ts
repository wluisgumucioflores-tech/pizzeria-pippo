"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserProfile, signOut } from "@/lib/auth";
import { formatTimeBolivia } from "@/lib/timezone";
import { notifyNewOrder, unlockAudioOnFirstInteraction } from "@/lib/notify";
import { useNewIdAlert } from "@/lib/useNewIdAlert";
import { KitchenService } from "../services/kitchen.service";
import type { KitchenOrder } from "../types/kitchen.types";

export function useKitchenOrders(lateThresholdMinutes: number) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [connected, setConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useNewIdAlert(orders.map((o) => o.id), notifyNewOrder);

  useEffect(() => {
    unlockAudioOnFirstInteraction();
  }, []);

  // Clock
  useEffect(() => {
    const tick = () => setCurrentTime(formatTimeBolivia(new Date()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load profile and branch
  useEffect(() => {
    getUserProfile().then((profile) => {
      if (profile?.branch_id) setBranchId(profile.branch_id);
    });
  }, []);

  useEffect(() => {
    if (!branchId) return;
    KitchenService.getBranchName(branchId).then((name) => { if (name) setBranchName(name); });
  }, [branchId]);

  const fetchOrders = useCallback(async () => {
    if (!branchId) return;
    const data = await KitchenService.getPendingOrders(branchId);
    setOrders(data);
  }, [branchId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime — listen for new orders and status changes
  useEffect(() => {
    if (!branchId) return;

    const channel = KitchenService.subscribeToOrders(
      branchId,
      () => {
        // Re-fetch to get full order with items
        fetchOrders();
      },
      (payload) => {
        if (payload.new.kitchen_status === "ready" || payload.new.cancelled_at) {
          setOrders((prev) => prev.filter((o) => o.id !== payload.new.id));
        } else {
          // Sigue pendiente pero algo cambió (ej. el mesero agregó items al
          // pedido) — no hay un evento dedicado a "cambiaron los items", así
          // que se refresca la orden completa para traer los items nuevos.
          fetchOrders();
        }
      },
      setConnected
    );

    return () => { KitchenService.unsubscribe(channel); };
  }, [branchId, fetchOrders]);

  const handleReady = useCallback(async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    await KitchenService.markOrderReady(orderId);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    window.location.href = "/login";
  }, []);

  // Botón manual para cuando el realtime no reconecta bien solo — refresca
  // la lista completa de pedidos pendientes sin depender del socket.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  const pendingCount = orders.length;
  const lateCount = orders.filter((o) => {
    const minutes = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
    return minutes >= lateThresholdMinutes;
  }).length;

  return {
    orders,
    branchName,
    currentTime,
    connected,
    refreshing,
    pendingCount,
    lateCount,
    handleReady,
    handleLogout,
    handleRefresh,
  };
}
