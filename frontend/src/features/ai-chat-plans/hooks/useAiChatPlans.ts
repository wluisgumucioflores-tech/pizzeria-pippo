"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, notification } from "antd";
import { AiChatPlansService } from "../services/aiChatPlans.service";
import { AiModelsService } from "@/features/ai-models/services/aiModels.service";
import type { AiModel } from "@/features/ai-models/types/aiModel.types";
import type { AiChatPlan, CreateAiChatPlanInput, UpdateAiChatPlanInput } from "../types/aiChatPlan.types";

export function useAiChatPlans() {
  const [plans, setPlans] = useState<AiChatPlan[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AiChatPlan | null>(null);
  const [form] = Form.useForm();

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const data = await AiChatPlansService.getPlans(true);
    setPlans(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlans();
    AiModelsService.getModels(false).then(setModels);
  }, [fetchPlans]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  // resetFields() before setFieldsValue() is mandatory: form is a
  // single instance reused across edits (see feedback_antd_form_reuse_bug).
  const openEdit = (plan: AiChatPlan) => {
    setEditing(plan);
    form.resetFields();
    form.setFieldsValue({
      name: plan.name,
      messages_per_day: plan.messages_per_day,
      is_active: plan.is_active,
      model_id: plan.model_id ?? undefined,
      allowed_write_domains: plan.allowed_write_domains,
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (values: CreateAiChatPlanInput & UpdateAiChatPlanInput) => {
    setSaving(true);
    const result = editing
      ? await AiChatPlansService.updatePlan(editing.id, values)
      : await AiChatPlansService.createPlan(values);

    if (result.ok) {
      setModalOpen(false);
      fetchPlans();
      notification.success({ message: editing ? "Plan actualizado" : "Plan creado" });
    } else {
      notification.error({ message: result.error ?? "Error al guardar el plan" });
    }
    setSaving(false);
  };

  const handleToggleActive = async (plan: AiChatPlan) => {
    const result = await AiChatPlansService.updatePlan(plan.id, { is_active: !plan.is_active });
    if (result.ok) {
      fetchPlans();
      notification.success({ message: plan.is_active ? "Plan desactivado" : "Plan reactivado" });
    } else {
      notification.error({ message: result.error ?? "Error al actualizar" });
    }
  };

  return {
    plans,
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
