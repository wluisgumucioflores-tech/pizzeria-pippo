"use client";

import { useStock } from "@/features/stock/hooks/useStock";
import { useIsMobile } from "@/lib/useIsMobile";
import { StockPageHeader } from "@/features/stock/components/StockPageHeader";
import { StockTabs } from "@/features/stock/components/StockTabs";
import { StockMinQtyModal } from "@/features/stock/components/StockMinQtyModal";

export default function ProduccionStockPage() {
  const isMobile = useIsMobile();

  const {
    branches, ingredients, alertsCount,
    unifiedStock, loadingUnifiedStock,
    search, setSearch,
    exportingStock, exportStockToExcel,
    selectedBranch, setSelectedBranch,
    PAGE_SIZE,
    minQtyOpen, setMinQtyOpen, editingStock,
    adjustForm, minQtyForm,
    productAdjustForm, handleProductAdjust,
    handleAdjust,
    openMinQty, handleMinQty,
    productVariants,
    productMinQtyOpen, setProductMinQtyOpen,
    editingProductStock,
    productMinQtyForm,
    openProductMinQty, handleProductMinQty,
    unifiedMovements, totalHistory, loadingHistory,
    pageHistory, setPageHistory,
  } = useStock();

  const handleEditMinQty = (row: (typeof unifiedStock)[number]) =>
    row.origin === "insumo" ? openMinQty(row.source) : openProductMinQty(row.source);

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <StockPageHeader
        isMobile={isMobile}
        alertCount={alertsCount}
        branches={branches}
        selectedBranch={selectedBranch}
        onSelectedBranchChange={setSelectedBranch}
        search={search}
        onSearchChange={setSearch}
        exporting={exportingStock}
        onExport={exportStockToExcel}
        exportDisabled={unifiedStock.length === 0}
      />
      <StockTabs
        isMobile={isMobile}
        alertsCount={alertsCount}
        unifiedStock={unifiedStock}
        loadingUnifiedStock={loadingUnifiedStock}
        onEditMinQty={handleEditMinQty}
        ingredients={ingredients}
        adjustForm={adjustForm}
        onAdjust={handleAdjust}
        productVariants={productVariants}
        productAdjustForm={productAdjustForm}
        onProductAdjust={handleProductAdjust}
        unifiedMovements={unifiedMovements}
        totalHistory={totalHistory}
        loadingHistory={loadingHistory}
        pageHistory={pageHistory}
        onPageHistoryChange={setPageHistory}
        pageSize={PAGE_SIZE}
      />
      <StockMinQtyModal
        open={minQtyOpen}
        editingStock={editingStock}
        form={minQtyForm}
        onClose={() => setMinQtyOpen(false)}
        onSubmit={handleMinQty}
      />
      <StockMinQtyModal
        open={productMinQtyOpen}
        editingStock={null}
        productStock={editingProductStock}
        form={productMinQtyForm}
        onClose={() => setProductMinQtyOpen(false)}
        onSubmit={handleProductMinQty}
      />
    </div>
  );
}
