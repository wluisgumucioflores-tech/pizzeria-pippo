"use client";

import { CategoriesTable } from "@/features/categories/components/CategoriesTable";
import { CategoryModal } from "@/features/categories/components/CategoryModal";
import { useCategories } from "@/features/categories/hooks/useCategories";

export default function CategoriesPage() {
  const { categories, loading, saving, modalOpen, editing, openCreate, openEdit, closeModal, handleSubmit, handleDelete } = useCategories();

  return (
    <div className="p-6">
      <CategoriesTable
        categories={categories}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <CategoryModal
        open={modalOpen}
        editing={editing}
        categories={categories}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
