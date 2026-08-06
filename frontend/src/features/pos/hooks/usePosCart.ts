"use client";

import { useState, useEffect, useRef } from "react";
import {
  applyPromotions, getActivePromotions, getTotalDiscount, getCartTotal,
  type CartItem, type DiscountedItem, type Promotion, type FlavorItem,
} from "@/lib/promotions";
import type { Product } from "../types/pos.types";

type OrderType = "dine_in" | "takeaway";

export function usePosCart(
  promotions: Promotion[],
  branchId: string | undefined,
  broadcast: (type: string, payload?: unknown) => void,
  getStockQty?: (variantId: string) => number | null
) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountedCart, setDiscountedCart] = useState<DiscountedItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const suppressClearRef = useRef(false);

  useEffect(() => {
    if (cart.length === 0) {
      setDiscountedCart([]);
      if (!suppressClearRef.current) broadcast("CART_CLEAR");
      suppressClearRef.current = false;
      return;
    }
    const active = getActivePromotions(promotions, branchId ?? "");
    const result = applyPromotions(cart, active);
    setDiscountedCart(result);
    broadcast("CART_UPDATE", { items: result, total: getCartTotal(result), orderType });
  }, [cart, promotions, branchId, broadcast, orderType]);

  const addToCart = (product: Product, variant: Product["product_variants"][0], price: number, flavors?: FlavorItem[]) => {
    setCart((prev) => {
      // Mixed pizzas are never merged with existing items — each is a separate line
      if (flavors && flavors.length > 0) {
        return [...prev, {
          variant_id: variant.id,
          qty: 1,
          unit_price: price,
          product_name: product.name,
          variant_name: variant.name,
          category: product.category,
          flavors,
        }];
      }
      const existing = prev.find((i) => i.variant_id === variant.id && !i.flavors && !i.promo_id);
      const maxQty = getStockQty?.(variant.id) ?? null;
      const currentQty = existing?.qty ?? 0;
      if (maxQty !== null && currentQty >= maxQty) return prev;
      if (existing) return prev.map((i) => i.variant_id === variant.id && !i.flavors && !i.promo_id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        variant_id: variant.id,
        qty: 1,
        unit_price: price,
        product_name: product.name,
        variant_name: variant.name,
        category: product.category,
      }];
    });
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.variant_id !== variantId) return i;
        const maxQty = getStockQty?.(variantId) ?? null;
        const newQty = i.qty + delta;
        if (delta > 0 && maxQty !== null && newQty > maxQty) return i;
        return { ...i, qty: newQty };
      }).filter((i) => i.qty > 0)
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const addItemsToCart = (items: CartItem[]) => {
    setCart((prev) => {
      let next = [...prev];
      for (const item of items) {
        if (item.flavors && item.flavors.length > 0) {
          next = [...next, item];
          continue;
        }
        const sameOrigin = (i: CartItem) => (i.promo_id ?? null) === (item.promo_id ?? null);
        const existing = next.find((i) => i.variant_id === item.variant_id && !i.flavors && sameOrigin(i));
        if (existing) {
          next = next.map((i) =>
            i.variant_id === item.variant_id && !i.flavors && sameOrigin(i) ? { ...i, qty: i.qty + item.qty } : i
          );
        } else {
          next = [...next, item];
        }
      }
      return next;
    });
  };

  const clearCart = () => {
    setCart([]);
    setOrderType(null);
    broadcast("CART_CLEAR");
  };

  const suppressNextClear = () => { suppressClearRef.current = true; };

  const total = getCartTotal(discountedCart);
  const totalDiscount = getTotalDiscount(discountedCart);

  return {
    cart, discountedCart, total, totalDiscount,
    orderType, setOrderType,
    addToCart, addItemsToCart, updateQty, removeFromCart, clearCart, suppressNextClear,
    getStockQty: getStockQty ?? (() => null),
  };
}
