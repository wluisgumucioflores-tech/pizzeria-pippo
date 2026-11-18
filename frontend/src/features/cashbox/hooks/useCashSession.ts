"use client";

import { useCallback, useEffect, useState } from "react";
import { CashboxService } from "../services/cashbox.service";
import type { CashExpenseCategory, CashSession } from "../types/cashbox.types";

// Caja del turno actual de una sucursal — abrir/registrar gasto/cerrar.
// `enabled` es el módulo cashbox del negocio: en false no dispara ningún
// fetch. Usado tanto por el POS (su propia sucursal) como por el panel admin
// (Reportes → Caja, elige sucursal) — `onChanged` deja que el admin refresque
// el historial de sesiones después de abrir/cerrar.
export function useCashSession(branchId: string | undefined, enabled: boolean, onChanged?: () => void) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSession(await CashboxService.getCurrentSession(branchId));
    setLoading(false);
  }, [branchId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openSession = async (openingAmount: number) => {
    if (!branchId) return;
    setSaving(true);
    setError(null);
    const result = await CashboxService.openSession(branchId, openingAmount);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo abrir la caja");
      return;
    }
    setSession(result.session ?? null);
    setOpenModalOpen(false);
    onChanged?.();
  };

  const addExpense = async (amount: number, category: CashExpenseCategory, note: string) => {
    if (!session) return;
    setSaving(true);
    setError(null);
    const result = await CashboxService.addExpense(session.id, amount, category, note.trim() || undefined);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo registrar el gasto");
      return;
    }
    setSession(result.session ?? null);
    setExpenseModalOpen(false);
  };

  const closeSession = async (countedAmount: number) => {
    if (!session) return;
    setSaving(true);
    setError(null);
    const result = await CashboxService.closeSession(session.id, countedAmount);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo cerrar la caja");
      return;
    }
    setSession(null);
    setCloseModalOpen(false);
    onChanged?.();
  };

  const dismissError = () => setError(null);

  // El modal de cierre muestra "ventas en efectivo" en vivo — sin este
  // refresh, mostraría lo que había la última vez que se tocó la caja (al
  // abrirla, o al último gasto), no lo vendido durante el resto del turno.
  const openCloseModal = () => {
    void refresh();
    setCloseModalOpen(true);
  };

  return {
    session,
    loading,
    saving,
    error,
    dismissError,
    openModalOpen,
    setOpenModalOpen,
    expenseModalOpen,
    setExpenseModalOpen,
    closeModalOpen,
    setCloseModalOpen,
    openCloseModal,
    openSession,
    addExpense,
    closeSession,
  };
}
