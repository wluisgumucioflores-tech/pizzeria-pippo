"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, notification } from "antd";
import { useTranslations } from "next-intl";
import { ProductionService } from "../services/production.service";
import type { Branch, WarehouseStockOption } from "../types/production.types";

export function useProductionTransfer() {
  const t = useTranslations("production.toasts");
  const [form] = Form.useForm();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stock, setStock] = useState<WarehouseStockOption[]>([]);
  const [available, setAvailable] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [branchList, stockList] = await Promise.all([
      ProductionService.getBranches(),
      ProductionService.getWarehouseStock(),
    ]);
    setBranches(branchList);
    setStock(stockList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleVariantChange = (variantId: string) => {
    const row = stock.find((s) => s.variant_id === variantId);
    setAvailable(row?.quantity ?? 0);
  };

  const handleSubmit = async (values: { variant_id: string; branch_id: string; quantity: number }) => {
    setSaving(true);
    const result = await ProductionService.transferToBranch(values);
    setSaving(false);
    if (result.ok) {
      notification.success({ message: t("transferDone") });
      form.resetFields();
      setAvailable(null);
      load();
      return true;
    }
    notification.error({ message: result.error ?? t("transferError") });
    return false;
  };

  return {
    form, branches, stock, available, saving, loading,
    handleVariantChange, handleSubmit,
  };
}
