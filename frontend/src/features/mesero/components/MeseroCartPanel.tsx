"use client";

import { MeseroCartItemRow } from "./MeseroCartItemRow";
import type { useMeseroCart } from "../hooks/useMeseroCart";

interface Props {
  cart: ReturnType<typeof useMeseroCart>;
  submitting: boolean;
  extraOptions: { name: string; price: number }[];
  addingToOrder: { id: string; dailyNumber: number } | null;
  onSubmit: () => void;
}

export function MeseroCartPanel({ cart, submitting, extraOptions, addingToOrder, onSubmit }: Props) {
  return (
    <div className="flex flex-col h-full p-4">
      {!addingToOrder && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => cart.setOrderType("dine_in")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border cursor-pointer transition-colors ${
                cart.orderType === "dine_in"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-300 text-gray-600"
              }`}
            >
              🍽️ Comer aquí
            </button>
            <button
              type="button"
              onClick={() => cart.setOrderType("takeaway")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border cursor-pointer transition-colors ${
                cart.orderType === "takeaway"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-300 text-gray-600"
              }`}
            >
              🥡 Para llevar
            </button>
          </div>

          {cart.orderType === "dine_in" && (
            <input
              type="text"
              value={cart.tableNumber}
              onChange={(e) => cart.setTableNumber(e.target.value)}
              placeholder="Mesa (ej: Mesa 5)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </>
      )}

      <div className="flex-1 overflow-y-auto">
        {cart.items.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">El carrito está vacío</p>
        ) : (
          cart.items.map((item) => (
            <MeseroCartItemRow
              key={item.variant_id}
              item={item}
              extraOptions={extraOptions}
              onUpdateQty={(delta) => cart.updateQty(item.variant_id, delta)}
              onRemove={() => cart.removeFromCart(item.variant_id)}
              onAddExtra={(name, price) => cart.addExtra(item.variant_id, { name, price })}
              onRemoveExtra={(idx) => cart.removeExtra(item.variant_id, idx)}
            />
          ))
        )}
      </div>

      <div className="border-t pt-3 mt-3">
        <div className="flex items-center justify-between font-semibold text-gray-800 mb-3">
          <span>Total</span>
          <span>Bs {cart.total.toFixed(2)}</span>
        </div>
        <button
          type="button"
          disabled={cart.items.length === 0 || submitting}
          onClick={onSubmit}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-md text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {submitting ? "Enviando..." : addingToOrder ? "Agregar al pedido" : "Realizar pedido"}
        </button>
      </div>
    </div>
  );
}
