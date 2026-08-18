"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { CategoriesService } from "../services/categories.service";
import type { Category, CategoryInput } from "../types/category.types";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCategories(await CategoriesService.getCategories());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (category: Category) => { setEditing(category); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (values: CategoryInput) => {
    setSaving(true);
    const result = editing
      ? await CategoriesService.updateCategory(editing.id, values)
      : await CategoriesService.createCategory(values);

    if (result.ok) {
      message.success(editing ? "Categoría actualizada" : "Categoría creada");
      setModalOpen(false);
      load();
    } else {
      message.error(result.error ?? "Error al guardar la categoría");
    }
    setSaving(false);
  };

  const handleDelete = async (category: Category) => {
    const result = await CategoriesService.deleteCategory(category.id);
    if (result.ok) {
      message.success("Categoría eliminada");
      load();
    } else {
      message.error(result.error ?? "Error al eliminar la categoría");
    }
  };

  return {
    categories, loading, saving,
    modalOpen, editing,
    openCreate, openEdit, closeModal,
    handleSubmit, handleDelete,
  };
}
