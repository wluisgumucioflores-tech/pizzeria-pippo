"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, message } from "antd";
import { getWarehouseProductStock, adjustWarehouseProductStock } from "../services/warehouse-product-stock.service";
import type { ProductStockRow } from "../types/warehouse.types";

function rowLabel(row: ProductStockRow): string {
  const pv = row.product_variants;
  if (!pv) return "";
  const productName = pv.products?.name ?? "";
  return pv.name === "Unidad" ? productName : `${productName} ${pv.name}`;
}

export function useWarehouseProductTable() {
  const [rows, setRows] = useState<ProductStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustingRow, setAdjustingRow] = useState<ProductStockRow | null>(null);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustForm] = Form.useForm();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"low" | "ok" | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getWarehouseProductStock();
    setRows(data as ProductStockRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdjust = (row: ProductStockRow) => {
    setAdjustingRow(row);
    adjustForm.setFieldsValue({ real_quantity: row.quantity, notes: "" });
  };

  const closeAdjust = () => {
    setAdjustingRow(null);
    adjustForm.resetFields();
  };

  const handleAdjust = async (values: { real_quantity: number; notes: string }) => {
    if (!adjustingRow) return;
    setAdjustLoading(true);
    const result = await adjustWarehouseProductStock({
      variant_id: adjustingRow.variant_id,
      real_quantity: values.real_quantity,
      notes: values.notes,
    });
    setAdjustLoading(false);
    if (!result.ok) {
      message.error(result.error ?? "Error al ajustar");
      return;
    }
    message.success("Stock ajustado correctamente");
    closeAdjust();
    load();
  };

  // Counts low stock across ALL rows, not just what the filters currently
  // show — same convention as WarehouseIngredientsTab's alertCount.
  const alertCount = rows.filter((r) => r.quantity < r.min_quantity).length;

  const searchLower = search.trim().toLowerCase();
  const filteredRows = rows.filter((r) => {
    if (searchLower && !rowLabel(r).toLowerCase().includes(searchLower)) return false;
    if (filterStatus === "low" && !(r.quantity < r.min_quantity)) return false;
    if (filterStatus === "ok" && r.quantity < r.min_quantity) return false;
    return true;
  });

  return {
    rows, filteredRows, loading, adjustingRow, adjustLoading, adjustForm, alertCount,
    search, setSearch, filterStatus, setFilterStatus,
    openAdjust, closeAdjust, handleAdjust,
  };
}
