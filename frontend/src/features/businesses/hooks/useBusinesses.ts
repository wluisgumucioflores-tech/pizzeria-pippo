"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, notification } from "antd";
import { BusinessesService } from "../services/businesses.service";
import type { Business, CreateBusinessInput } from "../types/business.types";

export function useBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    const data = await BusinessesService.getBusinesses();
    setBusinesses(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  const openCreate = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (values: CreateBusinessInput) => {
    setSaving(true);
    const result = await BusinessesService.createBusiness(values);

    if (result.ok) {
      setModalOpen(false);
      fetchBusinesses();
      notification.success({ message: "Negocio creado" });
    } else {
      notification.error({ message: result.error ?? "Error al crear el negocio" });
    }
    setSaving(false);
  };

  const handleToggleActive = async (business: Business) => {
    const result = await BusinessesService.toggleActive(business.id, !business.is_active);
    if (result.ok) {
      fetchBusinesses();
      notification.success({ message: business.is_active ? "Negocio suspendido" : "Negocio reactivado" });
    } else {
      notification.error({ message: result.error ?? "Error al actualizar" });
    }
  };

  return {
    businesses,
    loading,
    saving,
    modalOpen,
    form,
    openCreate,
    closeModal,
    handleSubmit,
    handleToggleActive,
  };
}
