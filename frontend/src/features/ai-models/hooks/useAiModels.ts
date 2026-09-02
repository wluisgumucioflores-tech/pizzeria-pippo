"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, notification } from "antd";
import { AiModelsService } from "../services/aiModels.service";
import type { AiModel, CreateAiModelInput, UpdateAiModelInput } from "../types/aiModel.types";

export function useAiModels() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AiModel | null>(null);
  const [form] = Form.useForm();

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const data = await AiModelsService.getModels(true);
    setModels(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  // resetFields() before setFieldsValue() is mandatory: form is a
  // single instance reused across edits (see feedback_antd_form_reuse_bug).
  const openEdit = (model: AiModel) => {
    setEditing(model);
    form.resetFields();
    form.setFieldsValue({
      provider: model.provider,
      model_id: model.model_id,
      label: model.label,
      base_url: model.base_url ?? undefined,
      is_local: model.is_local,
      is_active: model.is_active,
      is_default: model.is_default,
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (values: CreateAiModelInput & UpdateAiModelInput) => {
    setSaving(true);
    const result = editing
      ? await AiModelsService.updateModel(editing.id, values)
      : await AiModelsService.createModel(values);

    if (result.ok) {
      setModalOpen(false);
      fetchModels();
      notification.success({ message: editing ? "Modelo actualizado" : "Modelo creado" });
    } else {
      notification.error({ message: result.error ?? "Error al guardar el modelo" });
    }
    setSaving(false);
  };

  const handleToggleActive = async (model: AiModel) => {
    const result = await AiModelsService.updateModel(model.id, { is_active: !model.is_active });
    if (result.ok) {
      fetchModels();
      notification.success({ message: model.is_active ? "Modelo desactivado" : "Modelo reactivado" });
    } else {
      notification.error({ message: result.error ?? "Error al actualizar" });
    }
  };

  return {
    models,
    loading,
    saving,
    modalOpen,
    editing,
    form,
    openCreate,
    openEdit,
    closeModal,
    handleSubmit,
    handleToggleActive,
  };
}
