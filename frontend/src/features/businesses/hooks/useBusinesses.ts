"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, notification } from "antd";
import { BusinessesService } from "../services/businesses.service";
import type { Business, CreateBusinessInput, UpdateBusinessInput } from "../types/business.types";
import { BUSINESS_MODULE_KEYS } from "../constants/modules.constants";

export function useBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detailBusiness, setDetailBusiness] = useState<Business | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm] = Form.useForm();

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

  const openDetail = (business: Business) => setDetailBusiness(business);
  const closeDetail = () => setDetailBusiness(null);

  // resetFields() antes de setFieldsValue() es obligatorio: editForm es una
  // única instancia reutilizada entre ediciones, y antd no vuelve a aplicar
  // initialValues sobre un campo que ya tuvo valor en un edit anterior — sin
  // el reset, el formulario arrastra datos del negocio editado previamente.
  const openEdit = (business: Business) => {
    editForm.resetFields();
    editForm.setFieldsValue({
      name: business.name,
      enabled_modules_selected: BUSINESS_MODULE_KEYS.filter((key) => business.enabled_modules[key]),
    });
    setEditingBusiness(business);
  };
  const closeEdit = () => setEditingBusiness(null);

  const handleEditSubmit = async (values: UpdateBusinessInput) => {
    if (!editingBusiness) return;
    setEditSaving(true);
    const result = await BusinessesService.updateBusiness(editingBusiness.id, values);

    if (result.ok) {
      setEditingBusiness(null);
      fetchBusinesses();
      notification.success({ message: "Negocio actualizado" });
    } else {
      notification.error({ message: result.error ?? "Error al actualizar el negocio" });
    }
    setEditSaving(false);
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
    detailBusiness,
    openDetail,
    closeDetail,
    editingBusiness,
    editForm,
    editSaving,
    openEdit,
    closeEdit,
    handleEditSubmit,
  };
}
