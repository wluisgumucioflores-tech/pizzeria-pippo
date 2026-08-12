"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { getUserProfile, signOut } from "@/lib/auth";
import { formatTimeBolivia } from "@/lib/timezone";
import { notifyNewOrder, unlockAudioOnFirstInteraction } from "@/lib/notify";
import { useNewIdAlert } from "@/lib/useNewIdAlert";
import { KitchenService } from "@/features/kitchen/services/kitchen.service";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";
import type { KitchenOrder } from "@/features/kitchen/types/kitchen.types";

function useTimer(createdAt: string) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const calc = () => {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      setMinutes(Math.floor((now - created) / 60000));
    };
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return minutes;
}

const ORDER_TYPE_BADGES: Record<KitchenOrder["order_type"], { emoji: string; label: string; className: string }> = {
  dine_in: { emoji: "🍽️", label: "Local", className: "bg-gray-600 text-gray-200" },
  takeaway: { emoji: "🥡", label: "Para llevar", className: "bg-blue-500 text-white" },
  delivery: { emoji: "🛵", label: "Delivery", className: "bg-emerald-500 text-white" },
  pedidos_ya: { emoji: "📱", label: "Pedidos Ya", className: "bg-orange-500 text-white" },
};

function OrderCard({ order, onReady, lateThreshold }: { order: KitchenOrder; onReady: (id: string) => void; lateThreshold: number }) {
  const minutes = useTimer(order.created_at);
  const isLate = minutes >= lateThreshold;
  const localTime = formatTimeBolivia(order.created_at);
  const orderLabel = `#${String(order.daily_number).padStart(2, "0")}`;

  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-3 border-2 transition-all ${
        isLate
          ? "bg-red-950 border-red-500 shadow-red-900 shadow-lg"
          : "bg-gray-800 border-gray-700"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-2xl font-black text-white tracking-wider">{orderLabel}</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
              isLate ? "bg-red-500 text-white" : "bg-gray-600 text-gray-200"
            }`}>
              🕐 {minutes} min
            </span>
            <span className="text-gray-400 text-sm whitespace-nowrap">{localTime}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ORDER_TYPE_BADGES[order.order_type].className}`}>
            {ORDER_TYPE_BADGES[order.order_type].emoji} {ORDER_TYPE_BADGES[order.order_type].label}
          </span>
          {order.table_number && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-200 whitespace-nowrap">
              🪑 {order.table_number}
            </span>
          )}
          {order.waiter_name && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-200 whitespace-nowrap">
              🙋 {order.waiter_name}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className={`h-px ${isLate ? "bg-red-700" : "bg-gray-700"}`} />

      {/* Items */}
      <div className="flex flex-col gap-3 flex-1">
        {order.order_items.map((item, i) => {
          const qty = item.qty_physical ?? item.qty;
          const productName = item.product_variants?.products?.name ?? "—";
          const variantName = item.product_variants?.name ?? "";
          const description = item.product_variants?.products?.description ?? "";
          const flavors = item.order_item_flavors ?? [];
          const isMixed = flavors.length >= 2;

          const totalParts = flavors.reduce((sum, f) => sum + Math.round(f.proportion * 100), 0) || 100;

          return (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-orange-400 font-black text-xl w-8 shrink-0">{qty}x</span>
                <span className="text-white font-semibold text-base leading-tight">
                  {isMixed ? "Pizza mixta" : productName}
                  {variantName && (
                    <span className="text-gray-400 font-normal text-sm ml-1">— {variantName}</span>
                  )}
                </span>
              </div>
              {isMixed && (
                <div className="ml-10 flex flex-col gap-0.5 mt-0.5">
                  {flavors.map((f, fi) => {
                    const parts = Math.round(f.proportion * totalParts);
                    return (
                      <p key={fi} className="text-yellow-400 text-sm leading-snug font-medium m-0">
                        {parts}/{totalParts} {f.product_variants?.products?.name}
                      </p>
                    );
                  })}
                </div>
              )}
              {!isMixed && description && (
                <p className="text-gray-400 text-sm ml-10 leading-snug">{description}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Ready button */}
      <button
        onClick={() => onReady(order.id)}
        className="mt-2 w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold text-lg transition-colors"
      >
        ✓ Listo
      </button>
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [lateThreshold, setLateThreshold] = useState(10);
  const [connected, setConnected] = useState(true);

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
        }
      },
      setConnected
    );

    return () => { KitchenService.unsubscribe(channel); };
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
