"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Form, notification } from "antd";
import { IngredientsService } from "../services/ingredients.service";
import type { Ingredient } from "../types/ingredient.types";

export const PAGE_SIZE = 10;
const REVALIDATE_INTERVAL = 60 * 1000;

export function useIngredients() {
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form] = Form.useForm();

  const swrKey = ["ingredients", showInactive, page, debouncedSearch] as const;

  const { data, isLoading, mutate } = useSWR(
    swrKey,
    ([, showInactive, page, search]) =>
      IngredientsService.getIngredients({ showInactive, page, pageSize: PAGE_SIZE, search: search || undefined }),
    {
      revalidateOnFocus: false,
      dedupingInterval: REVALIDATE_INTERVAL,
      keepPreviousData: true,
    },
  );

  const ingredients = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleShowInactive = (val: boolean) => {
    setShowInactive(val);
    setPage(1);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Ingredient) => {
    setEditing(record);
    form.setFieldsValue({ name: record.name, unit: record.unit, is_shared_use: record.is_shared_use });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (values: { name: string; unit: string; is_shared_use?: boolean }) => {
    setSaving(true);
    const result = editing
      ? await IngredientsService.updateIngredient(editing.id, values)
      : await IngredientsService.createIngredient(values);

    if (result.ok) {
      setModalOpen(false);
      mutate();
      notification.success({ message: editing ? "Insumo actualizado" : "Insumo creado" });
    } else {
      notification.error({ message: result.error ?? "Error al guardar" });
    }
    setSaving(false);
  };

  const handleToggleActive = async (record: Ingredient) => {
    const result = await IngredientsService.toggleActive(record.id, !record.is_active);
    if (result.ok) {
      mutate();
      notification.success({ message: record.is_active ? "Insumo desactivado" : "Insumo reactivado" });
    } else {
      notification.error({ message: result.error ?? "Error al actualizar" });
    }
  };

  return {
    ingredients, total, loading: isLoading,
    saving, showInactive, setShowInactive: handleShowInactive,
    search, setSearch: handleSearch,
    page, setPage, PAGE_SIZE,
    modalOpen, editing, form,
    openCreate, openEdit, closeModal,
    handleSubmit, handleToggleActive,
    refetch: mutate,
  };
}
