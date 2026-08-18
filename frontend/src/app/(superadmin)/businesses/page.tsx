"use client";

import { BusinessesTable } from "@/features/businesses/components/BusinessesTable";
import { BusinessModal } from "@/features/businesses/components/BusinessModal";
import { BusinessDetailModal } from "@/features/businesses/components/BusinessDetailModal";
import { BusinessEditModal } from "@/features/businesses/components/BusinessEditModal";
import { useBusinesses } from "@/features/businesses/hooks/useBusinesses";

export default function BusinessesPage() {
  const {
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
  } = useBusinesses();

  return (
    <div className="p-6">
      <BusinessesTable
        businesses={businesses}
        loading={loading}
        onCreate={openCreate}
        onToggleActive={handleToggleActive}
        onViewDetail={openDetail}
        onEdit={openEdit}
      />
      <BusinessModal
        open={modalOpen}
        saving={saving}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
      <BusinessDetailModal business={detailBusiness} onClose={closeDetail} />
      <BusinessEditModal
        business={editingBusiness}
        saving={editSaving}
        form={editForm}
        onClose={closeEdit}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}
