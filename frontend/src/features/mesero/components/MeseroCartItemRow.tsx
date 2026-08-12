"use client";

import { useState } from "react";
import type { MeseroCartItem } from "../types/mesero.types";

interface Props {
  item: MeseroCartItem;
  onUpdateQty: (delta: number) => void;
  onRemove: () => void;
  onAddExtra: (name: string, price: number) => void;
  onRemoveExtra: (extraIndex: number) => void;
}

export function MeseroCartItemRow({ item, onUpdateQty, onRemove, onAddExtra, onRemoveExtra }: Props) {
  const [showExtraForm, setShowExtraForm] = useState(false);

  return (
    <div className="border-b py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-gray-800">{item.product_name}</div>
          <div className="text-xs text-gray-500">{item.variant_name}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onUpdateQty(-1)} className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer">−</button>
          <span className="w-6 text-center">{item.qty}</span>
          <button type="button" onClick={() => onUpdateQty(1)} className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer">+</button>
          <button type="button" onClick={onRemove} className="ml-2 text-red-400 hover:text-red-600 cursor-pointer">✕</button>
        </div>
      </div>

      {item.extras.length > 0 && (
        <ul className="mt-2 ml-2 space-y-1">
          {item.extras.map((extra, idx) => (
            <li key={idx} className="flex items-center justify-between text-sm text-gray-600">
              <span>+ {extra.name} (Bs {extra.price})</span>
              <button type="button" onClick={() => onRemoveExtra(idx)} className="text-red-400 hover:text-red-600 cursor-pointer">✕</button>
            </li>
          ))}
        </ul>
      )}

      {showExtraForm ? (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = (form.elements.namedItem("extraName") as HTMLInputElement).value;
            const price = Number((form.elements.namedItem("extraPrice") as HTMLInputElement).value || 0);
            if (!name.trim()) return;
            onAddExtra(name.trim(), price);
            form.reset();
            setShowExtraForm(false);
          }}
        >
          <input name="extraName" type="text" placeholder="Extra" required className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
          <input name="extraPrice" type="number" min={0} step="0.01" placeholder="Bs" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
          <button type="submit" className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">Agregar</button>
          <button type="button" onClick={() => setShowExtraForm(false)} className="text-sm text-gray-400 cursor-pointer">Cancelar</button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowExtraForm(true)} className="mt-2 text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
          + Agregar extra
        </button>
      )}
    </div>
  );
}
