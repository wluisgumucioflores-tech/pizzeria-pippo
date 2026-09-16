"use client";

import { ProductionTransferForm } from "@/features/production/components/ProductionTransferForm";
import { useProductionTransfer } from "@/features/production/hooks/useProductionTransfer";

export default function ProduccionTransferenciaPage() {
  const { form, branches, stock, available, saving, loading, handleVariantChange, handleSubmit } = useProductionTransfer();

  return (
    <ProductionTransferForm
      form={form}
      branches={branches}
      stock={stock}
      available={available}
      saving={saving}
      loading={loading}
      onVariantChange={handleVariantChange}
      onSubmit={handleSubmit}
    />
  );
}
