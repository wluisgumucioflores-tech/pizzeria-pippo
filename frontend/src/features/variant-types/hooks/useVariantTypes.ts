"use client";

import { useState, useEffect, useCallback } from "react";
import { notification } from "antd";
import { useTranslations } from "next-intl";
import { VariantTypesService } from "../services/variant-types.service";
import type { VariantType } from "../types/variant-type.types";

export function useVariantTypes() {
  const t = useTranslations("variantTypes.toasts");
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VariantType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await VariantTypesService.getVariantTypes(false);
    setVariantTypes(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (record: VariantType) => { setEditing(record); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSave = async (name: string) => {
    setSaving(true);
    const result = editing
      ? await VariantTypesService.update(editing.id, name)
      : await VariantTypesService.create(name);
    setSaving(false);

    if (result.ok) {
      notification.success({ message: editing ? t("updated") : t("created") });
      closeModal();
      load();
    } else {
      notification.error({ message: result.error ?? t("saveError") });
    }
  };

  const handleToggle = async (record: VariantType) => {
    const result = await VariantTypesService.toggle(record.id, !record.is_active);
    if (result.ok) {
      load();
    } else {
      notification.error({ message: result.error ?? t("toggleError") });
    }
  };

  return {
    variantTypes, loading, saving,
    modalOpen, editing,
    openCreate, openEdit, closeModal,
    handleSave, handleToggle,
  };
}
