"use client";

import { ProductsTable } from "@/features/products/components/ProductsTable";
import { useProducts } from "@/features/products/hooks/useProducts";
import { useRegisterRefresh } from "@/lib/refresh-context";

export default function ProductsPage() {
  const {
    products, total, page, PAGE_SIZE, setPage,
    loading, showInactive, setShowInactive,
    filterCategory, setFilterCategory,
    search, setSearch,
    handleToggleActive, handleDelete, handleDuplicate,
    refetch,
  } = useProducts();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <ProductsTable
        products={products}
        loading={loading}
        showInactive={showInactive}
        onToggleInactive={setShowInactive}
        filterCategory={filterCategory}
        onFilterCategory={setFilterCategory}
        search={search}
        onSearch={setSearch}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
}
