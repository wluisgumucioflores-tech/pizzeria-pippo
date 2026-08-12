"use client";

import { MeseroCartItemRow } from "./MeseroCartItemRow";
import type { useMeseroCart } from "../hooks/useMeseroCart";

interface Props {
  cart: ReturnType<typeof useMeseroCart>;
  submitting: boolean;
  onSubmit: () => void;
}

export function MeseroCartPanel({ cart, submitting, onSubmit }: Props) {
  return (
    <div className="flex flex-col h-full p-4">
      <input
        type="text"
        value={cart.tableNumber}
        onChange={(e) => cart.setTableNumber(e.target.value)}
        placeholder="Mesa (ej: Mesa 5)"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      <div className="flex-1 overflow-y-auto">
        {cart.items.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">El carrito está vacío</p>
        ) : (
          cart.items.map((item) => (
            <MeseroCartItemRow
              key={item.variant_id}
              item={item}
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
          {submitting ? "Enviando..." : "Realizar pedido"}
        </button>
      </div>
    </div>
  );
}
