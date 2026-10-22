"use client";

import { useState, useEffect, useCallback } from "react";
import { Form, notification } from "antd";
import { PromotionsService } from "../services/promotions.service";
import type { Promotion, Branch, Variant, Rule } from "../types/promotion.types";
import dayjs from "dayjs";

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [promoType, setPromoType] = useState<string>("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [promos, b, v] = await Promise.all([
      PromotionsService.getPromotions(showInactive),
      PromotionsService.getBranches(),
      PromotionsService.getVariants(),
    ]);
    setPromotions(promos);
    setBranches(b);
    setVariants(v);
    setLoading(false);
  }, [showInactive]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditing(null);
    setPromoType("");
    setRules([]);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Promotion) => {
    setEditing(record);
    setPromoType(record.type);
    setRules(
      (record.promotion_rules ?? []).map((r) => ({
        ...r,
        slot_type: (r.category || r.variant_size) ? "flexible" : "specific",
      }))
    );
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      days_of_week: record.days_of_week,
      dates: [dayjs(record.start_date), dayjs(record.end_date)],
      branch_id: record.branch_id ?? "all",
      active: record.active,
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = {
      name: values.name,
      type: values.type,
      days_of_week: values.days_of_week ?? [],
      start_date: values.dates[0].format("YYYY-MM-DD"),
      end_date: values.dates[1].format("YYYY-MM-DD"),
      branch_id: values.branch_id === "all" ? null : values.branch_id,
      active: values.active ?? true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      rules: rules.map(({ slot_type: _, ...r }) => r),
    };
    const result = editing
      ? await PromotionsService.updatePromotion(editing.id, payload)
      : await PromotionsService.createPromotion(payload);
    if (result.ok) { setModalOpen(false); fetchAll(); }
    else notification.error({ message: result.error });
  };

  const handleToggleIsActive = async (promo: Promotion) => {
    const result = await PromotionsService.patchPromotion(promo.id, { is_active: !promo.is_active });
    if (result.ok) {
      fetchAll();
      notification.success({ message: promo.is_active ? "Promoción desactivada" : "Promoción reactivada" });
    } else {
      notification.error({ message: result.error });
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await PromotionsService.patchPromotion(id, { active });
    fetchAll();
  };

  const addRule = () => {
    setRules((prev) => [...prev, { variant_id: null, buy_qty: null, get_qty: null, discount_percent: null, combo_price: null, category: null, variant_size: null, slot_type: "specific" }]);
  };

  const updateRule = (index: number, field: keyof Rule, value: unknown) => {
    setRules((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTypeChange = (type: string) => {
    setPromoType(type);
    setRules([]);
  };

  return {
    promotions, branches, variants, loading,
    modalOpen, editing, showInactive, setShowInactive,
    promoType, setPromoType,
    rules,
    form,
    openCreate, openEdit, closeModal,
    handleSave, handleToggleIsActive, handleToggleActive,
    handleTypeChange,
    addRule, updateRule, removeRule,
    refetch: fetchAll,
  };
}
