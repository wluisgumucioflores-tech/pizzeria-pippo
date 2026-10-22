"use client";

import { useState, useEffect } from "react";
import { ProductsService } from "../services/products.service";
import type { Ingredient, ProductDetail } from "../types/product.types";

export function useProductDetail(id: string) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProduct = async () => {
    const data = await ProductsService.getProductDetail(id);
    if (data) setProduct(data as ProductDetail);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadProduct(), ProductsService.getIngredients().then(setIngredients)]);
      setLoading(false);
    };
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { product, ingredients, loading, loadProduct, refetch: loadProduct };
}
