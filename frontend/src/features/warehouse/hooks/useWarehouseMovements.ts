"use client";

import { useState, useEffect, useCallback } from "react";
import { getIngredients, getBranches, getWarehouseMovements } from "../services/warehouse-ingredient-stock.service";
import { getWarehouseProductMovements } from "../services/warehouse-product-stock.service";
import dayjs from "dayjs";
import type {
  IngredientMovement, ProductMovement, UnifiedMovement,
  WMovIngredient, WMovBranch,
} from "../types/warehouse-movements.types";

function toUnified(m: IngredientMovement): UnifiedMovement {
  return {
    id: `ing-${m.id}`,
    quantity: m.quantity,
    type: m.type,
    branch_id: m.branch_id,
    notes: m.notes,
    created_by_name: m.created_by_name,
    created_at: m.created_at,
    origin: "ingredient",
    detailName: m.ingredients?.name ?? "—",
    unit: m.ingredients?.unit ?? "",
    branches: m.branches,
  };
}

function toUnifiedProduct(m: ProductMovement): UnifiedMovement {
  const pv = m.product_variants;
  const productName = pv?.products?.name ?? "";
  const detailName = pv
    ? pv.name === "Unidad" ? productName : `${productName} — ${pv.name}`
    : "—";
  return {
    id: `prod-${m.id}`,
    quantity: m.quantity,
    type: m.type,
    branch_id: m.branch_id,
    notes: m.notes,
    created_by_name: m.created_by_name,
    created_at: m.created_at,
    origin: "product",
    detailName,
    unit: "unid.",
    branches: m.branches,
  };
}

export function useWarehouseMovements() {
  const [movements, setMovements] = useState<UnifiedMovement[]>([]);
  const [ingredients, setIngredients] = useState<WMovIngredient[]>([]);
  const [branches, setBranches] = useState<WMovBranch[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterIngredient, setFilterIngredient] = useState<string | undefined>();
  const [filterBranch, setFilterBranch] = useState<string | undefined>();
  const [filterDates, setFilterDates] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [filterOrigin, setFilterOrigin] = useState<string | undefined>();

  useEffect(() => {
    getIngredients().then(setIngredients);
    getBranches().then(setBranches);
  }, []);

  const fetchMovements = useCallback(async () => {
    setLoading(true);

    const from = filterDates?.[0]?.startOf("day").toISOString();
    const to = filterDates?.[1]?.endOf("day").toISOString();

    const fetchIng = filterOrigin !== "product"
      ? getWarehouseMovements({ type: filterType, ingredientId: filterIngredient, branchId: filterBranch, from, to })
      : Promise.resolve([]);
    const fetchProd = filterOrigin !== "ingredient"
      ? getWarehouseProductMovements({ type: filterType, branchId: filterBranch, from, to })
      : Promise.resolve([]);

    const [ingData, prodData] = await Promise.all([fetchIng, fetchProd]);

    const merged = [
      ...ingData.map(toUnified),
      ...prodData.map(toUnifiedProduct),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setMovements(merged);
    setLoading(false);
  }, [filterType, filterIngredient, filterBranch, filterDates, filterOrigin]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  return {
    movements, ingredients, branches, loading,
    filterType, setFilterType,
    filterIngredient, setFilterIngredient,
    filterBranch, setFilterBranch,
    filterDates, setFilterDates,
    filterOrigin, setFilterOrigin,
  };
}
