"use client";

import { useState, useEffect } from "react";
import type { Promotion, CartItem, FlavorItem } from "@/lib/promotions";
import type { Product, Variant } from "../types/pos.types";
import type { SlotSelection, FlavorEntry } from "../types/promo-combo.types";

export function usePromoComboSelection(
  promo: Promotion | null,
  products: Product[],
  branchId: string,
  getVariantPrice: (variant: Variant, branchId: string) => number
) {
  const [selections, setSelections] = useState<(SlotSelection | null)[]>([]);
  const [flavorOverrides, setFlavorOverrides] = useState<Map<number, FlavorEntry[]>>(new Map());
  const [showFlavors, setShowFlavors] = useState<Set<number>>(new Set());

  const rules = promo?.promotion_rules ?? [];

  useEffect(() => {
    if (!promo) return;
    const fixed: (SlotSelection | null)[] = rules.map((rule) => {
      if (!rule.variant_id) return null;
      for (const p of products) {
        const v = p.product_variants.find((pv) => pv.id === rule.variant_id);
        if (v) return { variantId: v.id, productName: p.name, variantName: v.name, price: getVariantPrice(v, branchId), category: p.category };
      }
      return null;
    });
    setSelections(fixed);
    setFlavorOverrides(new Map());
    setShowFlavors(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promo?.id]);

  const allFilled = selections.length === rules.length && selections.every(Boolean);

  const selectOption = (slotIdx: number, product: Product, variant: Variant) => {
    setSelections((prev) => {
      const next = [...prev];
      next[slotIdx] = {
        variantId: variant.id,
        productName: product.name,
        variantName: variant.name,
        price: getVariantPrice(variant, branchId),
        category: product.category,
      };
      return next;
    });
    // reset flavor override for this slot
    setFlavorOverrides((prev) => { const m = new Map(prev); m.delete(slotIdx); return m; });
    setShowFlavors((prev) => { const s = new Set(prev); s.delete(slotIdx); return s; });
  };

  const setFlavorEntries = (slotIdx: number, entries: FlavorEntry[]) => {
    setFlavorOverrides((prev) => { const m = new Map(prev); m.set(slotIdx, entries); return m; });
  };

  const revealFlavorBuilder = (slotIdx: number) => {
    setShowFlavors((prev) => new Set(Array.from(prev).concat(slotIdx)));
  };

  const buildCartItems = (): CartItem[] => {
    const items = selections.map((sel, idx) => {
      if (!sel) return null as unknown as CartItem;
      const flavorEntries = flavorOverrides.get(idx);
      const totalParts = flavorEntries?.reduce((s, f) => s + f.parts, 0) ?? 1;
      const flavors: FlavorItem[] | undefined = flavorEntries && flavorEntries.length > 1
        ? flavorEntries.map((f) => ({ variant_id: f.variantId, product_name: f.productName, proportion: f.parts / totalParts }))
        : undefined;
      return {
        variant_id: sel.variantId,
        qty: 1,
        unit_price: sel.price,
        product_name: sel.productName,
        variant_name: sel.variantName,
        category: sel.category,
        ...(flavors ? { flavors } : {}),
        ...(promo ? { promo_id: promo.id } : {}),
      };
    });
    return items.filter(Boolean);
  };

  return {
    rules, selections, showFlavors, allFilled,
    selectOption, setFlavorEntries, revealFlavorBuilder, buildCartItems,
  };
}
