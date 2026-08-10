"use client";

import { BusinessesTable } from "@/features/businesses/components/BusinessesTable";
import { BusinessModal } from "@/features/businesses/components/BusinessModal";
import { useBusinesses } from "@/features/businesses/hooks/useBusinesses";

export default function BusinessesPage() {
  const { businesses, loading, saving, modalOpen, form, openCreate, closeModal, handleSubmit, handleToggleActive } = useBusinesses();

  return (
    <div className="p-6">
      <BusinessesTable
        businesses={businesses}
        loading={loading}
        onCreate={openCreate}
        onToggleActive={handleToggleActive}
      />
      <BusinessModal
        open={modalOpen}
        saving={saving}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
