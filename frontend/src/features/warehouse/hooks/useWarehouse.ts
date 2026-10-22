"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Form, message } from "antd";
import useSWR from "swr";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  fetchWarehouseStock,
  deleteWarehouseStock,
  adjustWarehouseStock,
  updateMinQuantity,
} from "../services/warehouse-ingredient-stock.service";
import type { WarehouseRow } from "../types/warehouse.types";

const PAGE_SIZE = 10;

export function useWarehouse() {
  const isMobile = useIsMobile();
  const [editingRow, setEditingRow] = useState<WarehouseRow | null>(null);
  const [adjustingRow, setAdjustingRow] = useState<WarehouseRow | null>(null);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<"low" | "ok" | undefined>();
  const [search, setSearch] = useState("");
  const [mobileRows, setMobileRows] = useState<WarehouseRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [minQtyForm] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const { data, isLoading, mutate } = useSWR(
    ["warehouse-stock", page, filterStatus] as const,
    ([, page, status]) => fetchWarehouseStock({ page, pageSize: PAGE_SIZE, status }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30 * 1000,
      keepPreviousData: true,
    },
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasMore = mobileRows.length < total;

  useEffect(() => {
    if (!isMobile || !data?.rows) return;
    if (page === 1) {
      setMobileRows(data.rows);
    } else {
      setMobileRows((prev) => {
        const existingIds = new Set(prev.map((r) => r.ingredient_id));
        const newRows = data.rows.filter((r: WarehouseRow) => !existingIds.has(r.ingredient_id));
        return [...prev, ...newRows];
      });
    }
    setLoadingMore(false);
  }, [data, page, isMobile]);

  const handleSentinel = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
  }, []);

  useEffect(() => {
    if (!isMobile || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !loadingMore) {
          setLoadingMore(true);
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isMobile, hasMore, isLoading, loadingMore]);

  const handleStatusFilter = (val: "low" | "ok" | undefined) => {
    setFilterStatus(val);
    setPage(1);
    setMobileRows([]);
  };

  const openMinQty = (row: WarehouseRow) => {
    setEditingRow(row);
    minQtyForm.setFieldsValue({ min_quantity: row.min_quantity });
  };

  const openAdjust = (row: WarehouseRow) => {
    setAdjustingRow(row);
    adjustForm.setFieldsValue({ real_quantity: row.quantity, notes: "" });
  };

  const handleDelete = async (row: WarehouseRow) => {
    const { ok, error } = await deleteWarehouseStock(row.id);
    if (!ok) { message.error(error ?? "Error al eliminar"); return; }
    message.success("Insumo eliminado de bodega");
    mutate();
  };

  const handleAdjust = async (values: { real_quantity: number; notes: string }) => {
    if (!adjustingRow) return;
    setAdjustLoading(true);
    const { ok, error } = await adjustWarehouseStock(adjustingRow.ingredient_id, values.real_quantity, values.notes);
    setAdjustLoading(false);
    if (!ok) { message.error(error ?? "Error al ajustar"); return; }
    message.success("Stock ajustado correctamente");
    setAdjustingRow(null);
    adjustForm.resetFields();
    mutate();
  };

  const handleMinQty = async (values: { min_quantity: number }) => {
    if (!editingRow) return;
    await updateMinQuantity(editingRow.id, values.min_quantity);
    setEditingRow(null);
    setPage(1);
    setMobileRows([]);
    mutate();
  };

  const filteredRows = search
    ? rows.filter((r) => r.ingredient_name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const displayMobileRows = search
    ? mobileRows.filter((r) => r.ingredient_name.toLowerCase().includes(search.toLowerCase()))
    : mobileRows;

  const alertCount = isMobile
    ? mobileRows.filter((r) => r.quantity < r.min_quantity).length
    : rows.filter((r) => r.quantity < r.min_quantity).length;

  return {
    rows, filteredRows, total, isLoading,
    isMobile, mobileRows, displayMobileRows, loadingMore, hasMore,
    alertCount, search, filterStatus, page, PAGE_SIZE,
    editingRow, adjustingRow, adjustLoading,
    minQtyForm, adjustForm,
    setSearch: (val: string) => setSearch(val),
    setPage,
    handleStatusFilter,
    handleSentinel,
    openMinQty, openAdjust,
    handleDelete, handleAdjust, handleMinQty,
    closeAdjust: () => { setAdjustingRow(null); adjustForm.resetFields(); },
    closeMinQty: () => setEditingRow(null),
    refetch: mutate,
  };
}
