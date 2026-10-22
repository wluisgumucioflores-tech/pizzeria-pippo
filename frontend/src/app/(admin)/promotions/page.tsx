"use client";

import dynamic from "next/dynamic";
import { PromotionsTable } from "@/features/promotions/components/PromotionsTable";
import { usePromotions } from "@/features/promotions/hooks/usePromotions";
import { useRegisterRefresh } from "@/lib/refresh-context";

const PromotionModal = dynamic(
  () => import("@/features/promotions/components/PromotionModal").then((m) => m.PromotionModal),
  { ssr: false }
);

export default function PromotionsPage() {
  const {
    promotions, branches, variants, loading,
    modalOpen, editing, showInactive, setShowInactive,
    promoType,
    rules, form,
    openCreate, openEdit, closeModal,
    handleSave, handleToggleIsActive, handleToggleActive,
    handleTypeChange,
    addRule, updateRule, removeRule,
    refetch,
  } = usePromotions();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <PromotionsTable
        promotions={promotions}
        branches={branches}
        loading={loading}
        showInactive={showInactive}
        onToggleInactive={setShowInactive}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
        onToggleIsActive={handleToggleIsActive}
      />
      <PromotionModal
        open={modalOpen}
        editing={editing}
        branches={branches}
        variants={variants}
        promoType={promoType}
        rules={rules}
        form={form}
        onClose={closeModal}
        onSave={handleSave}
        onTypeChange={handleTypeChange}
        onAddRule={addRule}
        onUpdateRule={updateRule}
        onRemoveRule={removeRule}
      />
    </div>
  );
}
