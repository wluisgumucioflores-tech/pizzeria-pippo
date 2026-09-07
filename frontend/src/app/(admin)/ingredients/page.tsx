"use client";

import { IngredientsTable } from "@/features/ingredients/components/IngredientsTable";
import { IngredientModal } from "@/features/ingredients/components/IngredientModal";
import { useIngredients } from "@/features/ingredients/hooks/useIngredients";
import { useRegisterRefresh } from "@/lib/refresh-context";

export default function IngredientsPage() {
  const {
    ingredients, total, loading, saving, showInactive, setShowInactive,
    search, setSearch,
    page, setPage, PAGE_SIZE,
    modalOpen, editing, form,
    openCreate, openEdit, closeModal,
    handleSubmit, handleToggleActive,
    refetch,
  } = useIngredients();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <IngredientsTable
        ingredients={ingredients}
        loading={loading}
        showInactive={showInactive}
        onToggleInactive={setShowInactive}
        search={search}
        onSearch={setSearch}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
      <IngredientModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
