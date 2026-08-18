"use client";

import { useOrderStage } from "../hooks/useOrderStage";
import { getStageColor, getReadableTextColor } from "../constants/kitchen-stage.constants";
import { formatTimeBolivia } from "@/lib/timezone";
import type { KitchenOrder, KitchenStageSettings } from "../types/kitchen.types";

const ORDER_TYPE_BADGES: Record<KitchenOrder["order_type"], { emoji: string; label: string; className: string }> = {
  dine_in: { emoji: "🍽️", label: "Local", className: "bg-gray-600 text-gray-200" },
  takeaway: { emoji: "🥡", label: "Para llevar", className: "bg-blue-500 text-white" },
  delivery: { emoji: "🛵", label: "Delivery", className: "bg-emerald-500 text-white" },
  pedidos_ya: { emoji: "📱", label: "Pedidos Ya", className: "bg-orange-500 text-white" },
};

export function OrderCard({
  order,
  onReady,
  stageSettings,
}: {
  order: KitchenOrder;
  onReady: (id: string) => void;
  stageSettings: KitchenStageSettings;
}) {
  const { minutes, stage } = useOrderStage(order.created_at, stageSettings);
  const color = getStageColor(stage, stageSettings);
  const badgeTextColor = getReadableTextColor(color);
  const isLate = stage === "late";
  const localTime = formatTimeBolivia(order.created_at);
  const orderLabel = `#${String(order.daily_number).padStart(2, "0")}`;
  const visibleItems = stageSettings.kitchen_visible_category_ids.length > 0
    ? order.order_items.filter((item) =>
        stageSettings.kitchen_visible_category_ids.includes(item.product_variants?.products?.category_id ?? ""))
    : order.order_items;

  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-3 border-2 transition-colors ${isLate ? "shadow-lg" : ""}`}
      style={{
        borderColor: color,
        background: `color-mix(in srgb, ${color} 14%, #111827)`,
        boxShadow: isLate ? `0 10px 25px -8px color-mix(in srgb, ${color} 55%, transparent)` : undefined,
      }}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-2xl font-black text-white tracking-wider">{orderLabel}</span>
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ backgroundColor: color, color: badgeTextColor }}
            >
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
          {order.last_ready_at && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500 text-gray-900 whitespace-nowrap animate-pulse">
              🔁 Reabierto — se agregó algo
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px" style={{ backgroundColor: color, opacity: 0.35 }} />

      {/* Items */}
      <div className="flex flex-col gap-3 flex-1">
        {visibleItems.length === 0 && (
          <p className="text-gray-500 text-base italic">Sin productos visibles en este pedido</p>
        )}
        {visibleItems.map((item, i) => {
          const qty = item.qty_physical ?? item.qty;
          const productName = item.product_variants?.products?.name ?? "—";
          const variantName = item.product_variants?.name ?? "";
          const description = item.product_variants?.products?.description ?? "";
          const flavors = item.order_item_flavors ?? [];
          const isMixed = flavors.length >= 2;
          const extras = item.order_item_extras ?? [];
          const isNew = !!order.last_ready_at && item.created_at > order.last_ready_at;

          const totalParts = flavors.reduce((sum, f) => sum + Math.round(f.proportion * 100), 0) || 100;

          return (
            <div key={i} className={`flex flex-col gap-0.5 ${isNew ? "bg-yellow-950 border border-yellow-600 rounded-lg p-2 -mx-2" : ""}`}>
              <div className="flex items-baseline gap-2">
                <span className="text-orange-400 font-black text-2xl w-9 shrink-0">{qty}x</span>
                <span className="text-white font-semibold text-lg leading-tight">
                  {isMixed ? "Pizza mixta" : productName}
                  {variantName && (
                    <span className="text-gray-400 font-normal text-base ml-1">— {variantName}</span>
                  )}
                  {isNew && (
                    <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500 text-gray-900 align-middle">🆕 Nuevo</span>
                  )}
                </span>
              </div>
              {isMixed && (
                <div className="ml-11 flex flex-col gap-0.5 mt-0.5">
                  {flavors.map((f, fi) => {
                    const parts = Math.round(f.proportion * totalParts);
                    return (
                      <p key={fi} className="text-yellow-400 text-base leading-snug font-medium m-0">
                        {parts}/{totalParts} {f.product_variants?.products?.name}
                      </p>
                    );
                  })}
                </div>
              )}
              {!isMixed && description && (
                <p className="text-gray-400 text-base ml-11 leading-snug">{description}</p>
              )}
              {extras.length > 0 && (
                <div className="ml-11 flex flex-col gap-0.5 mt-0.5">
                  {extras.map((extra, ei) => (
                    <p key={ei} className="text-emerald-400 text-base leading-snug font-semibold m-0">
                      ➕ {extra.name}
                    </p>
                  ))}
                </div>
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
