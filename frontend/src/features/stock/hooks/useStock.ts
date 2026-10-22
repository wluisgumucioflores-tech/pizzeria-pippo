"use client";

import { useState, useEffect } from "react";
import { Form, message } from "antd";
import dayjs from "dayjs";
import { StockService } from "../services/stock.service";
import { useIngredientStockData } from "./useIngredientStockData";
import { useProductStockData } from "./useProductStockData";
import type { Branch, Ingredient, StockRow, ProductStockRow, UnifiedMovement, UnifiedStockRow } from "../types/stock.types";

const PAGE_SIZE = 10;

function buildUnifiedStock(
  stock: ReturnType<typeof useIngredientStockData>["stock"],
  productStock: ReturnType<typeof useProductStockData>["productStock"],
): UnifiedStockRow[] {
  return [
    ...stock.map((s): UnifiedStockRow => ({
      id: `insumo-${s.id}`,
      origin: "insumo",
      name: s.ingredients?.name ?? s.ingredient_id,
      unit: s.ingredients?.unit ?? "",
      quantity: s.quantity,
      min_quantity: s.min_quantity,
      source: s,
    })),
    ...productStock.map((p): UnifiedStockRow => ({
      id: `reventa-${p.id}`,
      origin: "reventa",
      name: p.product_variants?.products?.name ?? p.variant_id,
      secondaryName: p.product_variants?.name !== "Unidad" ? p.product_variants?.name : undefined,
      unit: "unidad",
      quantity: p.quantity,
      min_quantity: p.min_quantity,
      source: p,
    })),
  ];
}

function buildUnifiedMovements(
  ingredientMovements: ReturnType<typeof useIngredientStockData>["movements"],
  productMovements: ReturnType<typeof useProductStockData>["movements"],
): UnifiedMovement[] {
  return [
    ...ingredientMovements.map((m): UnifiedMovement => ({
      id: m.id,
      created_at: m.created_at,
      detail: m.ingredients?.name ?? m.ingredient_id,
      quantity: m.quantity,
      type: m.type,
      notes: m.notes,
      origin: "insumo",
    })),
    ...productMovements.map((m): UnifiedMovement => ({
      id: m.id,
      created_at: m.created_at,
      detail: m.product_variants?.products?.name
        ? `${m.product_variants.products.name}${m.product_variants.name !== "Unidad" ? ` — ${m.product_variants.name}` : ""}`
        : m.variant_id,
      quantity: m.quantity,
      type: m.type,
      notes: m.notes,
      origin: "reventa",
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function useStock() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [pageHistory, setPageHistory] = useState(1);
  const [minQtyOpen, setMinQtyOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockRow | null>(null);
  const [productMinQtyOpen, setProductMinQtyOpen] = useState(false);
  const [editingProductStock, setEditingProductStock] = useState<ProductStockRow | null>(null);
  const [purchaseIngredientIsNew, setPurchaseIngredientIsNew] = useState(false);
  const [purchaseVariantIsNew, setPurchaseVariantIsNew] = useState(false);

  const [purchaseForm] = Form.useForm();
  const [adjustForm] = Form.useForm();
  const [minQtyForm] = Form.useForm();
  const [productMinQtyForm] = Form.useForm();
  const [productPurchaseForm] = Form.useForm();
  const [productAdjustForm] = Form.useForm();

  useEffect(() => {
    Promise.all([StockService.getBranches(), StockService.getIngredients()]).then(([b, i]) => {
      setBranches(b);
      setIngredients(i);
      if (b.length) setSelectedBranch((prev) => prev || b[0].id);
    });
  }, []);

  const [search, setSearch] = useState("");
  const [exportingStock, setExportingStock] = useState(false);

  const ing = useIngredientStockData(selectedBranch, pageHistory, PAGE_SIZE);
  const prod = useProductStockData(selectedBranch, pageHistory, PAGE_SIZE);

  const { stock, totalStock, loadingStock } = ing;
  const { productStock, loadingProductStock, productVariants } = prod;

  const unifiedStockRaw = buildUnifiedStock(stock, productStock);
  const loadingUnifiedStock = loadingStock || loadingProductStock;
  // Cuenta de alertas sobre TODO el stock, no solo lo filtrado por búsqueda.
  const alertsCount = unifiedStockRaw.filter((r) => r.quantity <= r.min_quantity).length;

  const searchLower = search.trim().toLowerCase();
  const unifiedStock = searchLower
    ? unifiedStockRaw.filter(
        (r) => r.name.toLowerCase().includes(searchLower) || r.secondaryName?.toLowerCase().includes(searchLower),
      )
    : unifiedStockRaw;

  const unifiedMovements = buildUnifiedMovements(ing.movements, prod.movements);
  const totalHistory = ing.totalMovements + prod.totalMovements;
  const loadingHistory = ing.loadingMovements || prod.loadingMovements;

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    setPageHistory(1);
    productPurchaseForm.resetFields();
    setPurchaseVariantIsNew(false);
  };

  const handlePurchaseIngredientChange = (ingredientId: string) => {
    const isNew = !stock.some((s) => s.ingredient_id === ingredientId);
    setPurchaseIngredientIsNew(isNew);
    if (!isNew) purchaseForm.setFieldValue("min_quantity", undefined);
  };

  const handlePurchaseVariantChange = (variantId: string) => {
    const isNew = !productStock.some((s) => s.variant_id === variantId);
    setPurchaseVariantIsNew(isNew);
    if (!isNew) productPurchaseForm.setFieldValue("min_quantity", undefined);
  };

  const handlePurchase = async (values: { ingredient_id: string; quantity: number; min_quantity?: number }) => {
    const result = await StockService.purchase({ branch_id: selectedBranch, ...values });
    if (result.ok) { purchaseForm.resetFields(); setPurchaseIngredientIsNew(false); ing.refreshStock(); ing.refreshMovements(); }
    else message.error(result.error);
  };

  const handleAdjust = async (values: { ingredient_id: string; real_quantity: number; notes?: string }) => {
    const result = await StockService.adjust({ branch_id: selectedBranch, ...values });
    if (result.ok) { adjustForm.resetFields(); ing.refreshStock(); ing.refreshMovements(); }
    else message.error(result.error);
  };

  const handleProductPurchase = async (values: { variant_id: string; quantity: number; min_quantity?: number }) => {
    const result = await StockService.productPurchase({ branch_id: selectedBranch, ...values });
    if (result.ok) { productPurchaseForm.resetFields(); setPurchaseVariantIsNew(false); prod.refreshProductStock(); prod.refreshMovements(); }
    else message.error(result.error);
  };

  const handleProductAdjust = async (values: { variant_id: string; real_quantity: number; notes?: string }) => {
    const result = await StockService.productAdjust({ branch_id: selectedBranch, ...values });
    if (result.ok) { productAdjustForm.resetFields(); prod.refreshProductStock(); prod.refreshMovements(); }
    else message.error(result.error);
  };

  const openMinQty = (record: StockRow) => {
    setEditingStock(record);
    minQtyForm.setFieldsValue({ min_quantity: record.min_quantity });
    setMinQtyOpen(true);
  };

  const handleMinQty = async (values: { min_quantity: number }) => {
    if (!editingStock) return;
    const ok = await StockService.updateMinQuantity(editingStock.id, values.min_quantity);
    if (ok) { setMinQtyOpen(false); ing.refreshStock(); }
  };

  const openProductMinQty = (record: ProductStockRow) => {
    setEditingProductStock(record);
    productMinQtyForm.setFieldsValue({ min_quantity: record.min_quantity });
    setProductMinQtyOpen(true);
  };

  const handleProductMinQty = async (values: { min_quantity: number }) => {
    if (!editingProductStock) return;
    const ok = await StockService.updateProductMinQuantity(editingProductStock.id, values.min_quantity);
    if (ok) { setProductMinQtyOpen(false); prod.refreshProductStock(); }
  };

  // Exporta lo que está actualmente visible en la tabla (respeta la búsqueda
  // por nombre), no todo el stock de la sucursal sin filtrar.
  const exportStockToExcel = async () => {
    setExportingStock(true);
    const rows = unifiedStock.map((r) => ({
      Tipo: r.origin === "insumo" ? "Insumo" : "Reventa",
      Nombre: r.name,
      Variante: r.secondaryName ?? "",
      Unidad: r.unit,
      "Stock actual": r.quantity,
      "Stock mínimo": r.min_quantity,
      Estado: r.quantity <= r.min_quantity ? "Stock bajo" : "OK",
    }));

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `stock_${dayjs().format("YYYY-MM-DD")}.xlsx`);
    setExportingStock(false);
  };

  return {
    branches, ingredients, stock, totalStock,
    unifiedStock, loadingUnifiedStock, alertsCount,
    search, setSearch,
    exportingStock, exportStockToExcel,
    selectedBranch, setSelectedBranch: handleBranchChange,
    pageHistory, setPageHistory,
    PAGE_SIZE,
    loadingStock,
    minQtyOpen, setMinQtyOpen,
    editingStock,
    purchaseIngredientIsNew,
    purchaseForm, adjustForm, minQtyForm,
    handlePurchaseIngredientChange,
    handlePurchase, handleAdjust,
    openMinQty, handleMinQty,
    productStock, loadingProductStock,
    productVariants,
    purchaseVariantIsNew,
    productPurchaseForm,
    productAdjustForm,
    handlePurchaseVariantChange,
    handleProductPurchase,
    handleProductAdjust,
    productMinQtyOpen, setProductMinQtyOpen,
    editingProductStock,
    productMinQtyForm,
    openProductMinQty, handleProductMinQty,
    unifiedMovements, totalHistory, loadingHistory,
    refetch: () => {
      ing.refreshStock();
      ing.refreshMovements();
      prod.refreshProductStock();
      prod.refreshMovements();
    },
  };
}
