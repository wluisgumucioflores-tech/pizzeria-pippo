"use client";

import { useState } from "react";
import type { MeseroCartItem } from "../types/mesero.types";

interface Props {
  item: MeseroCartItem;
  extraOptions: { name: string; price: number }[];
  onUpdateQty: (delta: number) => void;
  onRemove: () => void;
  onAddExtra: (name: string, price: number) => void;
  onRemoveExtra: (extraIndex: number) => void;
}

export function MeseroCartItemRow({ item, extraOptions, onUpdateQty, onRemove, onAddExtra, onRemoveExtra }: Props) {
  const [showExtraPicker, setShowExtraPicker] = useState(false);

  return (
    <div className="border-b py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-800 text-lg">{item.product_name}</div>
          <div className="text-sm text-gray-500">{item.variant_name}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onUpdateQty(-1)} className="w-9 h-9 text-lg rounded bg-gray-100 hover:bg-gray-200 cursor-pointer">−</button>
          <span className="w-6 text-center text-lg font-medium">{item.qty}</span>
          <button type="button" onClick={() => onUpdateQty(1)} className="w-9 h-9 text-lg rounded bg-gray-100 hover:bg-gray-200 cursor-pointer">+</button>
          <button type="button" onClick={onRemove} className="ml-2 text-red-400 hover:text-red-600 cursor-pointer text-lg">✕</button>
        </div>
      </div>

      {item.extras.length > 0 && (
        <ul className="mt-2 ml-2 space-y-1">
          {item.extras.map((extra, idx) => (
            <li key={idx} className="flex items-center justify-between text-base text-gray-600">
              <span>+ {extra.name} (Bs {extra.price})</span>
              <button type="button" onClick={() => onRemoveExtra(idx)} className="text-red-400 hover:text-red-600 cursor-pointer">✕</button>
            </li>
          ))}
        </ul>
      )}

      {item.category !== "bebida" && (showExtraPicker ? (
        <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
          {extraOptions.length === 0 ? (
            <p className="text-sm text-gray-400 px-3 py-2">
              No hay productos en la categoría &quot;Otros&quot; para agregar como extra.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {extraOptions.map((opt) => (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => onAddExtra(opt.name, opt.price)}
                  className="flex items-center justify-between px-3 py-2 text-base text-left hover:bg-gray-50 cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <span className="text-blue-500">➕</span>
                    {opt.name}
                  </span>
                  <span className="text-gray-500">Bs {opt.price}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowExtraPicker(false)}
            className="w-full py-1.5 text-sm text-gray-400 hover:text-gray-600 border-t border-gray-100 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowExtraPicker(true)} className="mt-2 text-base text-blue-600 hover:text-blue-800 cursor-pointer">
          + Agregar extra
        </button>
      ))}
    </div>
  );
}
