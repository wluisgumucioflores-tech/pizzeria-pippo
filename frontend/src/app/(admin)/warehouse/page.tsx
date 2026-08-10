"use client";

import { useState } from "react";
import { Tabs } from "antd";
import { useTranslations } from "next-intl";
import { useWarehouse } from "@/features/warehouse/hooks/useWarehouse";
import { WarehousePageHeader } from "@/features/warehouse/components/WarehousePageHeader";
import { WarehouseIngredientsTab } from "@/features/warehouse/components/WarehouseIngredientsTab";
import { WarehouseProductTable } from "@/features/warehouse/components/WarehouseProductTable";
import { WarehouseAdjustModal, WarehouseMinQtyModal } from "@/features/warehouse/components/WarehouseModals";

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState("ingredients");
  const t = useTranslations("warehouse");
  const {
    filteredRows, displayMobileRows, total, isLoading,
    isMobile, mobileRows, loadingMore, hasMore,
    alertCount, search, filterStatus, page, PAGE_SIZE,
    editingRow, adjustingRow, adjustLoading,
    minQtyForm, adjustForm,
    setSearch, setPage,
    handleStatusFilter, handleSentinel,
    openMinQty, openAdjust,
    handleDelete, handleAdjust, handleMinQty,
    closeAdjust, closeMinQty,
  } = useWarehouse();

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <WarehousePageHeader isMobile={isMobile} alertCount={alertCount} />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 0 }}
        items={[
          {
            key: "ingredients",
            label: t("tabIngredients"),
            children: (
              <WarehouseIngredientsTab
                isMobile={isMobile}
                search={search}
                onSearchChange={setSearch}
                filterStatus={filterStatus}
                onStatusFilterChange={handleStatusFilter}
                filteredRows={filteredRows}
                displayMobileRows={displayMobileRows}
                mobileRows={mobileRows}
                total={total}
                isLoading={isLoading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                page={page}
                pageSize={PAGE_SIZE}
                sentinelRef={handleSentinel}
                onPageChange={setPage}
                onAdjust={openAdjust}
                onEditMinQty={openMinQty}
                onDelete={handleDelete}
              />
            ),
          },
          {
            key: "products",
            label: t("tabProducts"),
            children: <WarehouseProductTable isMobile={isMobile} />,
          },
        ]}
      />

      <WarehouseAdjustModal
        adjustingRow={adjustingRow}
        form={adjustForm}
        loading={adjustLoading}
        onSubmit={handleAdjust}
        onClose={closeAdjust}
      />
      <WarehouseMinQtyModal
        editingRow={editingRow}
        form={minQtyForm}
        onSubmit={handleMinQty}
        onClose={closeMinQty}
      />
    </div>
  );
}
