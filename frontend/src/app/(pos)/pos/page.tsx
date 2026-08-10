"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { usePosIdentity } from "@/features/pos/hooks/usePosIdentity";
import { usePosProducts } from "@/features/pos/hooks/usePosProducts";
import { usePosCart } from "@/features/pos/hooks/usePosCart";
import { usePosBroadcast } from "@/features/pos/hooks/usePosBroadcast";
import { useDayOrders } from "@/features/pos/hooks/useDayOrders";
import { usePaymentValidation } from "@/features/pos/hooks/usePaymentValidation";
import { usePosPageActions } from "@/features/pos/hooks/usePosPageActions";
import { PosHeader } from "@/features/pos/components/PosHeader";
import type { PosTab } from "@/features/pos/types/pos.types";
import { PosMainArea } from "@/features/pos/components/PosMainArea";
import { PosModals } from "@/features/pos/components/PosModals";
import { DayOrdersPanel } from "@/features/pos/components/DayOrdersPanel";
import { DaySummaryPanel } from "@/features/pos/components/DaySummaryPanel";
import { BranchSelector } from "@/features/pos/components/BranchSelector";
import { PrinterStatusButton } from "@/features/printing/components/PrinterStatusButton";
import { usePrinter } from "@/features/printing/hooks/usePrinter";
import { getActivePromotions } from "@/lib/promotions";

export default function PosPage() {
  const t = useTranslations("pos");
  const { identity, branches, effectiveBranchId, isAdminChoosingBranch, selectBranch, handleLogout } = usePosIdentity();
  const { broadcast } = usePosBroadcast();
  const { products, promotions, loading, getVariantPrice, getPromoLabel, getStockQty, refresh: refreshProducts } = usePosProducts(effectiveBranchId ?? undefined);
  const cart = usePosCart(promotions, effectiveBranchId ?? undefined, broadcast, getStockQty);
  const [activeTab, setActiveTab] = useState<PosTab>("sale");
  const isMobile = useIsMobile();
  const { dayOrders, markingReady, fetchDayOrders, handleMarkReady, cancelModal, cancelling, openCancelModal, closeCancelModal, handleCancelOrder } = useDayOrders(effectiveBranchId ?? undefined, activeTab !== "sale");
  const printer = usePrinter();
  const paymentValidation = usePaymentValidation(effectiveBranchId ?? undefined);

  const actions = usePosPageActions({
    branchId: effectiveBranchId ?? "",
    isMobile,
    products,
    getVariantPrice,
    cart,
    broadcast,
    fetchDayOrders,
    refreshProducts,
    paymentValidation,
    setActiveTab,
  });

  if (!identity) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
        <div style={{ color: "#9ca3af" }}>{t("loading")}</div>
      </div>
    );
  }

  if (isAdminChoosingBranch) {
    return (
      <BranchSelector branches={branches} userName={identity.name} onSelect={selectBranch} onLogout={handleLogout} />
    );
  }

  const branchId = effectiveBranchId!;
  const activePromotions = getActivePromotions(promotions, branchId);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f5f5f5", overflow: "hidden" }}>
      <PosHeader
        identity={identity}
        branches={branches}
        activeTab={activeTab}
        pendingCount={dayOrders.filter((o) => o.kitchen_status === "pending" && !o.cancelled_at).length}
        promoCount={activePromotions.length}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        printerSlot={
          <PrinterStatusButton
            status={printer.status}
            deviceName={printer.deviceName}
            onConnect={printer.connect}
            onDisconnect={printer.disconnect}
          />
        }
      />

      {(activeTab === "sale" || activeTab === "promos") && (
        <PosMainArea
          activeTab={activeTab}
          isMobile={isMobile}
          mobileView={actions.mobileView}
          onMobileViewChange={actions.setMobileView}
          products={products}
          loading={loading}
          branchId={branchId}
          getVariantPrice={getVariantPrice}
          getPromoLabel={getPromoLabel}
          onProductClick={actions.handleProductClick}
          cart={cart}
          onOpenPayment={() => actions.setPaymentModal(true)}
          activePromotions={activePromotions}
          onAddItems={actions.handlePromoItems}
          onAddSingleVariant={actions.handlePromoSingleVariant}
        />
      )}

      {activeTab === "orders" && (
        <DayOrdersPanel dayOrders={dayOrders} markingReady={markingReady} onMarkReady={handleMarkReady} onCancel={openCancelModal} />
      )}

      {activeTab === "summary" && (
        <DaySummaryPanel dayOrders={dayOrders} />
      )}

      <PosModals
        branchId={branchId}
        branches={branches}
        products={products}
        cart={cart}
        paymentValidation={paymentValidation}
        actions={actions}
        getVariantPrice={getVariantPrice}
        getPromoLabel={getPromoLabel}
        printer={printer}
        cancelModal={cancelModal}
        cancelling={cancelling}
        onCancelOrder={handleCancelOrder}
        onCloseCancelModal={closeCancelModal}
      />
    </div>
  );
}
