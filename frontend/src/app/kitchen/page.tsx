"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { getUserProfile, signOut } from "@/lib/auth";
import { formatTimeBolivia } from "@/lib/timezone";
import { notifyNewOrder, unlockAudioOnFirstInteraction } from "@/lib/notify";
import { useNewIdAlert } from "@/lib/useNewIdAlert";
import { KitchenService } from "@/features/kitchen/services/kitchen.service";
import { OrderCard } from "@/features/kitchen/components/OrderCard";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";
import type { KitchenOrder } from "@/features/kitchen/types/kitchen.types";

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [lateThreshold, setLateThreshold] = useState(10);
  const [connected, setConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    unlockAudioOnFirstInteraction();
  }, []);

  useNewIdAlert(orders.map((o) => o.id), notifyNewOrder);

  // Load kitchen late threshold from settings
  useEffect(() => {
    KitchenService.getLateThresholdMinutes().then((minutes) => {
      if (minutes !== null) setLateThreshold(minutes);
    });
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

  // Load branch name
  useEffect(() => {
    if (!branchId) return;
    KitchenService.getBranchName(branchId).then((name) => { if (name) setBranchName(name); });
  }, [branchId]);

  const fetchOrders = useCallback(async () => {
    if (!branchId) return;
    const data = await KitchenService.getPendingOrders(branchId);
    setOrders(data);
  }, [branchId]);

  // Initial load
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

  // Respaldo del realtime — el socket a veces no entrega el evento de
  // cancelación de forma confiable (wifi de la tablet, tab en background),
  // dejando pedidos anulados visibles hasta que alguien toca "Actualizar".
  // Este poll autocorrige la vista sola en máximo 30s.
  useEffect(() => {
    if (!branchId) return;
    const interval = setInterval(() => { fetchOrders(); }, 30000);
    return () => clearInterval(interval);
  }, [branchId, fetchOrders]);

  const handleReady = async (orderId: string) => {
    // Optimistic update
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    await KitchenService.markOrderReady(orderId);
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  // Botón manual para cuando el realtime no reconecta bien solo — refresca
  // la lista completa de pedidos pendientes sin depender del socket.
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const pendingCount = orders.length;
  const lateCount = orders.filter((o) => {
    const minutes = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
    return minutes >= lateThreshold;
  }).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-950 border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Pippo"
            width={36}
            height={36}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
          <div>
            <p className="text-white font-bold text-lg leading-none">Cocina</p>
            {branchName && (
              <p className="text-gray-400 text-sm leading-none mt-0.5">{branchName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {!connected && (
            <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              🔴 Sin conexión
            </span>
          )}
          {lateCount > 0 && (
            <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              ⚠ {lateCount} demorado{lateCount > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-gray-400 text-sm">
            {pendingCount === 0
              ? "Sin pedidos pendientes"
              : `${pendingCount} pedido${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""}`}
          </span>
          <span className="text-gray-300 font-mono text-xl">{currentTime}</span>
          <LocaleSwitcher dark />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-gray-300 hover:text-white text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>🔄</span> Actualizar
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-300 hover:text-white text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors whitespace-nowrap"
          >
            🚪 Salir
          </button>
        </div>
      </div>

      {/* Orders grid */}
      <div className="flex-1 p-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
            <span className="text-7xl">🍕</span>
            <p className="text-2xl font-semibold">Sin pedidos pendientes</p>
            <p className="text-base">Los nuevos pedidos aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReady={handleReady}
                lateThreshold={lateThreshold}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
