"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PosService } from "../services/pos.service";
import type { Product } from "../types/pos.types";
import type { Promotion } from "@/lib/promotions";
import { todayInBolivia } from "@/lib/timezone";

interface VariantMeta {
  category: string;
  variantName: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PosCache {
  date: string;
  branchId: string;
  cachedAt: number;
  products: Product[];
  promotions: Promotion[];
  useStock: boolean;
}

function getCached(branchId: string): PosCache | null {
  try {
    const raw = sessionStorage.getItem("pos_cache");
    if (!raw) return null;
    const cached: PosCache = JSON.parse(raw);
    if (cached.date !== todayInBolivia() || cached.branchId !== branchId) return null;
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function setCache(branchId: string, products: Product[], promotions: Promotion[], useStock: boolean) {
  try {
    const payload: PosCache = { date: todayInBolivia(), branchId, cachedAt: Date.now(), products, promotions, useStock };
    sessionStorage.setItem("pos_cache", JSON.stringify(payload));
  } catch {
    // sessionStorage full or unavailable — continue without cache
  }
}

export function usePosProducts(branchId: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [useStock, setUseStock] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (id: string, skipCache = false) => {
    const cached = skipCache ? null : getCached(id);
    if (cached) {
      setProducts(cached.products);
      setPromotions(cached.promotions);
      setUseStock(cached.useStock);
    } else {
      setLoading(true);
    }
    const result = await PosService.getProductsAndPromotions(id);
    setProducts(result.products);
    setPromotions(result.promotions);
    setUseStock(result.useStock);
    setCache(id, result.products, result.promotions, result.useStock);
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    return branchId ? fetchData(branchId, true) : Promise.resolve();
  }, [branchId, fetchData]);

  useEffect(() => {
    if (branchId) fetchData(branchId);
  }, [branchId, fetchData]);

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

  return { products, promotions, useStock, loading, getVariantPrice, getPromoLabel, getStockQty, refresh };
}
