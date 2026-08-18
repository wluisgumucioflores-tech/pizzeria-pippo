"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { notification } from "antd";
import { ProductsService } from "../services/products.service";
import type { Branch, Product } from "../types/product.types";

const PAGE_SIZE = 10;
const DEDUP_INTERVAL = 60 * 1000;

export function useProducts() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    ProductsService.getBranches().then(setBranches);
  }, []);

  const swrKey = ["products", showInactive, page, debouncedSearch, filterCategory] as const;

  const { data, isLoading: loading, mutate } = useSWR(
    swrKey,
    ([, showInactive, page, search, category_id]) =>
      ProductsService.getProducts({ showInactive, page, pageSize: PAGE_SIZE, search: search || undefined, category_id }),
    {
      revalidateOnFocus: false,
      dedupingInterval: DEDUP_INTERVAL,
      keepPreviousData: true,
    },
  );

  const products = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleToggleActive = async (product: Product) => {
    const { ok, error } = await ProductsService.patchProduct(product.id, { is_active: !product.is_active });
    if (ok) {
      mutate();
      notification.success({ message: product.is_active ? "Producto desactivado" : "Producto reactivado" });
    } else {
      notification.error({ message: error ?? "Error al actualizar" });
    }
  };

  const handleDelete = async (product: Product) => {
    const { ok, error } = await ProductsService.deleteProduct(product.id);
    if (ok) {
      mutate();
      notification.success({ message: "Producto eliminado" });
    } else {
      notification.error({ message: error ?? "Error al eliminar" });
    }
  };

  const handleDuplicate = async (product: Product) => {
    const { ok, id, error } = await ProductsService.duplicateProduct(product.id);
    if (ok && id) {
      notification.success({ message: "Producto duplicado, ajustá la copia antes de activarla" });
      router.push(`/products/${id}/edit`);
    } else {
      notification.error({ message: error ?? "Error al duplicar" });
    }
  };

  const handleShowInactive = (val: boolean) => { setShowInactive(val); setPage(1); };
  const handleCategoryFilter = (val: string | null) => { setFilterCategory(val); setPage(1); };

  return {
    products,
    total,
    page,
    PAGE_SIZE,
    setPage,
    branches,
    loading,
    showInactive,
    setShowInactive: handleShowInactive,
    filterCategory,
    setFilterCategory: handleCategoryFilter,
    search,
    setSearch,
    handleToggleActive,
    handleDelete,
    handleDuplicate,
    mutate,
  };
}
