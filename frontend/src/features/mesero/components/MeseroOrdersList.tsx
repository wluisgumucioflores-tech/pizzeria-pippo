"use client";

import type { DayOrder } from "@/features/pos/types/pos.types";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
  ready: { label: "Listo", className: "bg-green-100 text-green-800" },
};

interface Props {
  orders: DayOrder[];
  loading: boolean;
}

export function MeseroOrdersList({ orders, loading }: Props) {
  if (loading) return <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>;
  if (orders.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Todavía no creaste pedidos hoy</p>;

  return (
    <div className="space-y-3 p-4">
      {orders.map((order) => {
        const badge = STATUS_BADGES[order.kitchen_status] ?? { label: order.kitchen_status, className: "bg-gray-100 text-gray-700" };
        return (
          <div key={order.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-800">#{String(order.daily_number).padStart(2, "0")}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
            </div>
            {order.table_number && <div className="text-sm text-gray-500 mb-1">🪑 {order.table_number}</div>}
            <ul className="text-sm text-gray-600 mb-2">
              {order.order_items.map((item, idx) => (
                <li key={idx}>
                  {item.qty}x {item.product_variants?.products?.name ?? "?"} {item.product_variants?.name ?? ""}
                </li>
              ))}
            </ul>
            <div className="text-right font-medium text-gray-800">Bs {order.total.toFixed(2)}</div>
          </div>
        );
      })}
    </div>
  );
}
