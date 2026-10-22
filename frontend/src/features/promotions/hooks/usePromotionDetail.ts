"use client";

import { useState, useEffect, useCallback } from "react";
import { PromotionsService } from "../services/promotions.service";
import type { Promotion, Branch, Variant } from "../types/promotion.types";

export function usePromotionDetail(id: string) {
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      PromotionsService.getPromotion(id),
      PromotionsService.getBranches(),
      PromotionsService.getVariants(),
    ]).then(([promo, b, v]) => {
      setPromotion(promo);
      setBranches(b);
      setVariants(v);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { promotion, branches, variants, loading, refetch: load };
}
