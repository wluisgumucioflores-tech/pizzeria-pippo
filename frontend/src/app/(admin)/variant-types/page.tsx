"use client";

import { VariantTypesTable } from "@/features/variant-types/components/VariantTypesTable";
import { VariantTypeModal } from "@/features/variant-types/components/VariantTypeModal";
import { useVariantTypes } from "@/features/variant-types/hooks/useVariantTypes";
import { useRegisterRefresh } from "@/lib/refresh-context";

export default function VariantTypesPage() {
  const {
    variantTypes, loading, saving,
    modalOpen, editing,
    openCreate, openEdit, closeModal,
    handleSave, handleToggle,
    refetch,
  } = useVariantTypes();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <VariantTypesTable
        variantTypes={variantTypes}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggle={handleToggle}
      />
      <VariantTypeModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        onSave={handleSave}
        onClose={closeModal}
      />
    </div>
  );
}
