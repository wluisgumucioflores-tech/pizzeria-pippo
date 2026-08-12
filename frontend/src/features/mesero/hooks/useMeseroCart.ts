"use client";

import { useState } from "react";
import type { MeseroCartItem, MeseroExtra, MeseroOrderType } from "../types/mesero.types";
import type { Product } from "@/features/pos/types/pos.types";

export function useMeseroCart() {
  const [items, setItems] = useState<MeseroCartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState<MeseroOrderType>("dine_in");

  const addToCart = (product: Product, variant: Product["product_variants"][0], price: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant_id === variant.id);
      if (existing) {
        return prev.map((i) => (i.variant_id === variant.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, {
        variant_id: variant.id,
        qty: 1,
        unit_price: price,
        product_name: product.name,
        variant_name: variant.name,
        category: product.category,
        extras: [],
      }];
    });
  };

  const updateQty = (variantId: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => (i.variant_id === variantId ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0)
    );
  };

  const removeFromCart = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const addExtra = (variantId: string, extra: MeseroExtra) => {
    setItems((prev) =>
      prev.map((i) => (i.variant_id === variantId ? { ...i, extras: [...i.extras, extra] } : i))
    );
  };

  const removeExtra = (variantId: string, extraIndex: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.variant_id === variantId ? { ...i, extras: i.extras.filter((_, idx) => idx !== extraIndex) } : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setTableNumber("");
    setOrderType("dine_in");
  };

  const total = items.reduce((sum, i) => {
    const extrasUnitPrice = i.extras.reduce((s, e) => s + e.price, 0);
    return sum + (i.unit_price + extrasUnitPrice) * i.qty;
  }, 0);

  return {
    items, total, tableNumber, setTableNumber, orderType, setOrderType,
    addToCart, updateQty, removeFromCart, addExtra, removeExtra, clearCart,
  };
}
