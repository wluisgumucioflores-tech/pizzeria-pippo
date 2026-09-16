"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Form, notification } from "antd";
import { useTranslations } from "next-intl";
import type { Dayjs } from "dayjs";
import type { Ingredient } from "@pippo/shared";
import { IngredientsService } from "@/features/ingredients/services/ingredients.service";
import { ProductionService } from "../services/production.service";
import type { IngredientUsageLog } from "../types/production.types";

export const PAGE_SIZE = 10;

export function useIngredientUsage() {
  const t = useTranslations("production.toasts");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRangeState] = useState<[Dayjs, Dayjs] | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientUsageLog | null>(null);
  const [form] = Form.useForm();

  const from = dateRange?.[0]?.format("YYYY-MM-DD");
  const to = dateRange?.[1]?.format("YYYY-MM-DD");

  const { data, isLoading, mutate } = useSWR(
    ["ingredient-usage-logs", page, from, to] as const,
    ([, page, from, to]) => ProductionService.getIngredientUsageLogs({ page, pageSize: PAGE_SIZE, from, to }),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    IngredientsService.getIngredients({ pageSize: 1000 }).then((res) => setIngredients(res.data));
  }, []);

  const setDateRange = (range: [Dayjs, Dayjs] | null) => {
    setDateRangeState(range);
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: IngredientUsageLog) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({ ingredient_id: record.ingredient_id, quantity: record.quantity });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (values: { ingredient_id: string; quantity: number }) => {
    setSaving(true);
    const result = editing
      ? await ProductionService.updateIngredientUsage(editing.id, values)
      : await ProductionService.logIngredientUsage(values);

    if (result.ok) {
      setModalOpen(false);
      notification.success({ message: editing ? t("updated") : t("ingredientCreated") });
      mutate();
    } else {
      notification.error({ message: result.error ?? t("saveError") });
    }
    setSaving(false);
  };

  const handleDelete = async (record: IngredientUsageLog) => {
    const result = await ProductionService.deleteIngredientUsage(record.id);
    if (result.ok) {
      notification.success({ message: t("deleted") });
      mutate();
    } else {
      notification.error({ message: result.error ?? t("deleteError") });
    }
  };

  return {
    ingredients, logs, total, page, setPage, pageSize: PAGE_SIZE,
    dateRange, setDateRange,
    loading: isLoading, saving, modalOpen, editing, form,
    openCreate, openEdit, closeModal, handleSubmit, handleDelete,
  };
}
