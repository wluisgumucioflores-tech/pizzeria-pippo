"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, notification } from "antd";
import { AnnouncementsService } from "../services/announcements.service";
import { BusinessesService } from "@/features/businesses/services/businesses.service";
import type { Business } from "@/features/businesses/types/business.types";
import type { Announcement, UpsertAnnouncementInput } from "../types/announcement.types";

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const data = await AnnouncementsService.getAnnouncements();
    setAnnouncements(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    BusinessesService.getBusinesses().then(setBusinesses);
  }, [fetchAnnouncements]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
  };

  // resetFields() before setFieldsValue() — same reason as in
  // useBusinesses.ts/useUsers.ts: the form gets reused between edits.
  const openEdit = (record: Announcement) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({ business_id: record.business_id, message: record.message, is_active: record.is_active });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (values: { business_id: string; message: string; is_active?: boolean }) => {
    setSaving(true);
    const payload: UpsertAnnouncementInput = { message: values.message, is_active: values.is_active ?? true };
    const result = await AnnouncementsService.upsertAnnouncement(values.business_id, payload);

    if (result.ok) {
      setModalOpen(false);
      fetchAnnouncements();
      notification.success({ message: editing ? "Banner actualizado" : "Banner creado" });
    } else {
      notification.error({ message: result.error ?? "Error al guardar el banner" });
    }
    setSaving(false);
  };

  const handleDelete = async (record: Announcement) => {
    const result = await AnnouncementsService.deleteAnnouncement(record.business_id);
    if (result.ok) {
      fetchAnnouncements();
      notification.success({ message: "Banner eliminado" });
    } else {
      notification.error({ message: result.error ?? "Error al eliminar" });
    }
  };

  return {
    announcements,
    businesses,
    loading,
    saving,
    modalOpen,
    editing,
    form,
    openCreate,
    openEdit,
    closeModal,
    handleSubmit,
    handleDelete,
  };
}
