"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PosService } from "../services/pos.service";
import { PosCatalogCache } from "../services/pos-catalog-cache.service";
import { requestPersistentStorage } from "@/lib/offline-db";
import type { Product } from "../types/pos.types";
import type { Promotion } from "@/lib/promotions";

interface VariantMeta {
  category: string | null;
  variantName: string;
}

export function usePosProducts(branchId: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [useStock, setUseStock] = useState(true);
  const [enableTableNumber, setEnableTableNumber] = useState(false);
  const [loading, setLoading] = useState(false);
  // True when what's on screen came from the cache and the refresh failed —
  // the cashier can keep selling but prices may be out of date.
  const [servingCached, setServingCached] = useState(false);

  const fetchData = useCallback(async (id: string, skipCache = false) => {
    const cached = skipCache ? null : await PosCatalogCache.read(id);
    if (cached) {
      setProducts(cached.catalog.products);
      setPromotions(cached.catalog.promotions);
      setUseStock(cached.catalog.useStock);
      setEnableTableNumber(cached.catalog.enableTableNumber);
      setServingCached(false);
      // A fresh cache needs no network round trip at all — this is what lets
      // the POS open instantly on a slow connection.
      if (!cached.isStale) return;
    } else {
      setLoading(true);
    }

    try {
      const result = await PosService.getProductsAndPromotions(id);
      setProducts(result.products);
      setPromotions(result.promotions);
      setUseStock(result.useStock);
      setEnableTableNumber(result.enableTableNumber);
      setServingCached(false);
      await PosCatalogCache.write({ branchId: id, ...result });
    } catch {
      // This used to have no catch at all, so a failed request left `loading`
      // stuck at true forever — the POS spinner that never resolved. Now the
      // cached catalog (if any) stays on screen and the cashier is told.
      setServingCached(!!cached);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    return branchId ? fetchData(branchId, true) : Promise.resolve();
  }, [branchId, fetchData]);

  // Actualiza stock_quantity de las variantes puntuales que devuelve una venta
  // recién confirmada, en vez de recargar todo el catálogo (getPosCatalog).
  const applyStockUpdates = useCallback((updates: { variant_id: string; quantity: number }[]) => {
    if (!updates.length || !branchId) return;
    const qtyByVariant = new Map(updates.map((u) => [u.variant_id, u.quantity]));
    setProducts((prev) => {
      const next = prev.map((product) => ({
        ...product,
        product_variants: product.product_variants.map((variant) =>
          qtyByVariant.has(variant.id)
            ? { ...variant, stock_quantity: qtyByVariant.get(variant.id)! }
            : variant
        ),
      }));
      void PosCatalogCache.write({ branchId, products: next, promotions, useStock, enableTableNumber });
      return next;
    });
  }, [branchId, promotions, useStock, enableTableNumber]);

  // Offline counterpart of applyStockUpdates: a queued sale gets no server
  // response to read absolute quantities from, so the sold units are subtracted
  // locally. Without this the cashier could keep selling the same last unit
  // while the connection is down.
  const decrementLocalStock = useCallback((sold: { variant_id: string; qty_physical: number }[]) => {
    if (!sold.length || !branchId) return;
    const soldByVariant = new Map<string, number>();
    for (const item of sold) {
      soldByVariant.set(item.variant_id, (soldByVariant.get(item.variant_id) ?? 0) + item.qty_physical);
    }
    setProducts((prev) => {
      const next = prev.map((product) => ({
        ...product,
        product_variants: product.product_variants.map((variant) => {
          const qty = soldByVariant.get(variant.id);
          // Untracked variants (made-to-order) carry no stock_quantity.
          if (qty === undefined || variant.stock_quantity == null) return variant;
          return { ...variant, stock_quantity: variant.stock_quantity - qty };
        }),
      }));
      void PosCatalogCache.write({ branchId, products: next, promotions, useStock, enableTableNumber });
      return next;
    });
  }, [branchId, promotions, useStock, enableTableNumber]);

  useEffect(() => {
    if (branchId) fetchData(branchId);
  }, [branchId, fetchData]);

  // Ask once per session so the browser doesn't evict the cached catalog (and,
  // more importantly, the sales queue) when disk space runs low.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const getVariantPrice = (variant: Product["product_variants"][0], bid: string) => {
    const override = variant.branch_prices?.find((bp) => bp.branch_id === bid);
    return override ? override.price : variant.base_price;
  };

  const variantMeta = useMemo((): Map<string, VariantMeta> => {
    const map = new Map<string, VariantMeta>();
    for (const product of products) {
      for (const variant of product.product_variants) {
        map.set(variant.id, { category: product.category, variantName: variant.name });
      }
    }
    return map;
  }, [products]);

  const getPromoLabel = useCallback((variantId: string): string | null => {
    for (const promo of promotions) {
      for (const rule of promo.promotion_rules) {
        if (rule.variant_id === variantId) {
          if (promo.type === "BUY_X_GET_Y" && rule.buy_qty && rule.get_qty)
            return `${rule.buy_qty + rule.get_qty}x${rule.buy_qty}`;
          if (promo.type === "PERCENTAGE" && rule.discount_percent)
            return `${rule.discount_percent}% OFF`;
          if (promo.type === "COMBO") return "COMBO";
        }

        if (!rule.variant_id) {
          if (promo.type === "PERCENTAGE" && rule.discount_percent)
            return `${rule.discount_percent}% OFF`;

          if (promo.type === "COMBO") {
            const meta = variantMeta.get(variantId);
            const categoryMatch = !rule.category || meta?.category === rule.category;
            const sizeMatch = !rule.variant_size || meta?.variantName === rule.variant_size;
            if (categoryMatch && sizeMatch) return "COMBO";
          }
        }
      }
    }
    return null;
  }, [promotions, variantMeta]);

  // Si el negocio desactivó el control de stock (Configuración → Inventario),
  // nunca hay límite de cantidad — se vende sin importar lo cargado en stock_quantity.
  const getStockQty = useCallback((variantId: string): number | null => {
    if (!useStock) return null;
    for (const p of products) {
      const v = p.product_variants?.find((pv) => pv.id === variantId);
      if (v) return v.stock_quantity !== undefined ? (v.stock_quantity ?? null) : null;
    }
    return null;
  }, [products, useStock]);

  return { products, promotions, useStock, enableTableNumber, loading, servingCached, getVariantPrice, getPromoLabel, getStockQty, refresh, applyStockUpdates, decrementLocalStock };
}
