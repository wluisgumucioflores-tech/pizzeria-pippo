"use client";

import { ProductionOutputTable } from "@/features/production/components/ProductionOutputTable";
import { ProductionOutputModal } from "@/features/production/components/ProductionOutputModal";
import { useProductionOutput } from "@/features/production/hooks/useProductionOutput";

export default function ProduccionElaboracionPage() {
  const {
    variants, logs, total, page, setPage, pageSize, dateRange, setDateRange,
    loading, saving, modalOpen, editing, form,
    openCreate, openEdit, closeModal, handleSubmit, handleDelete,
  } = useProductionOutput();

  return (
    <>
      <ProductionOutputTable
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
      <ProductionOutputModal
        open={modalOpen}
        saving={saving}
        editing={editing}
        variants={variants}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </>
  );
}
