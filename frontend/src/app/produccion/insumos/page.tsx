"use client";

import { IngredientUsageTable } from "@/features/production/components/IngredientUsageTable";
import { IngredientUsageModal } from "@/features/production/components/IngredientUsageModal";
import { useIngredientUsage } from "@/features/production/hooks/useIngredientUsage";

export default function ProduccionInsumosPage() {
  const {
    ingredients, logs, total, page, setPage, pageSize, dateRange, setDateRange,
    loading, saving, modalOpen, editing, form,
    openCreate, openEdit, closeModal, handleSubmit, handleDelete,
  } = useIngredientUsage();

  return (
    <>
      <IngredientUsageTable
        logs={logs}
        loading={loading}
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <IngredientUsageModal
        open={modalOpen}
        saving={saving}
        editing={editing}
        ingredients={ingredients}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </>
  );
}
