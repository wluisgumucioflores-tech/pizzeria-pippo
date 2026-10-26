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
import { useOfflineSales } from "@/features/pos/hooks/useOfflineSales";
import { useOnlineOrders } from "@/features/online-orders/hooks/useOnlineOrders";
import { OnlineOrdersPanel } from "@/features/online-orders/components/OnlineOrdersPanel";
import { OfflineQueueBadge } from "@/features/pos/components/OfflineQueueBadge";
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
import { ChangePasswordModal } from "@/features/account/components/ChangePasswordModal";
import { useChangePassword } from "@/features/account/hooks/useChangePassword";

export default function PosPage() {
  const t = useTranslations("pos");
  const { identity, branches, effectiveBranchId, isAdminChoosingBranch, selectBranch, handleLogout } = usePosIdentity();
  const { broadcast } = usePosBroadcast();
  const { products, promotions, useStock, enableTableNumber, loading, getVariantPrice, getPromoLabel, getStockQty, refresh: refreshProducts, applyStockUpdates, decrementLocalStock, servingCached } = usePosProducts(effectiveBranchId ?? undefined);
  const cart = usePosCart(promotions, effectiveBranchId ?? undefined, broadcast, getStockQty);
  const [activeTab, setActiveTab] = useState<PosTab>("sale");
  const [refreshing, setRefreshing] = useState(false);
  const isMobile = useIsMobile();
  const {
    dayOrders, markingReady, fetchDayOrders, handleMarkReady,
    cancelModal, cancelling, openCancelModal, closeCancelModal, handleCancelOrder,
    payModal, paying, openPayModal, closePayModal, handlePayOrder,
    addItemsModal, openAddItemsModal, closeAddItemsModal, handleItemsAdded,
    connected,
  } = useDayOrders(effectiveBranchId ?? undefined);
  const printer = usePrinter();
  const paymentValidation = usePaymentValidation(effectiveBranchId ?? undefined);
  const changePassword = useChangePassword();

  const handleRefresh = async () => {
    if (!effectiveBranchId) return;
    setRefreshing(true);
    await Promise.all([refreshProducts(), fetchDayOrders(effectiveBranchId)]);
    setRefreshing(false);
  };

  // Off unless the superadmin enabled the offlineSales module for this
  // business — with it off, useOfflineSales does nothing at all.
  const offlineEnabled = identity?.offline_sales === true;
  const offlineSales = useOfflineSales(effectiveBranchId ?? undefined, offlineEnabled);

  // Same contract for the QR requests tab: module off → the hook no-ops and
  // the tab isn't rendered at all (count stays null).
  const onlineEnabled = identity?.online_orders === true;
  const onlineOrders = useOnlineOrders(effectiveBranchId ?? undefined, onlineEnabled);

  const actions = usePosPageActions({
    branchId: effectiveBranchId ?? "",
    isMobile,
    products,
    getVariantPrice,
    cart,
    broadcast,
    applyStockUpdates,
    decrementLocalStock,
    offlineSales,
    offlineEnabled,
    paymentValidation,
    setActiveTab,
  });

  if (!identity) {
    return (
      <div className="app-shell-height" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
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
    <div className="app-shell-height pb-safe" style={{ display: "flex", flexDirection: "column", background: "#f5f5f5", overflow: "hidden" }}>
      <PosHeader
        identity={identity}
        branches={branches}
        activeTab={activeTab}
        pendingCount={dayOrders.filter((o) => o.kitchen_status === "pending" && !o.cancelled_at).length}
        promoCount={activePromotions.length}
        connected={connected}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onTabChange={setActiveTab}
        onChangePassword={changePassword.openModal}
        onLogout={handleLogout}
        onlineOrdersCount={onlineEnabled ? onlineOrders.count : null}
        offlineSlot={
          <OfflineQueueBadge
            snapshot={offlineSales.snapshot}
            servingCached={servingCached}
            onSyncNow={() => void offlineSales.syncNow()}
          />
        }
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
          useStock={useStock}
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
        <DayOrdersPanel dayOrders={dayOrders} markingReady={markingReady} onMarkReady={handleMarkReady} onCancel={openCancelModal} onPay={openPayModal} onPrint={actions.handlePrintDayOrder} onAddItems={openAddItemsModal} />
      )}

      {activeTab === "online" && onlineEnabled && (
        <OnlineOrdersPanel
          orders={onlineOrders.orders}
          loaded={onlineOrders.loaded}
          acting={onlineOrders.acting}
          onRefresh={() => void onlineOrders.refresh()}
          onConfirm={(id) => void onlineOrders.confirm(id)}
          onReject={(id, reason) => void onlineOrders.reject(id, reason)}
        />
      )}

      {activeTab === "summary" && (
        <DaySummaryPanel dayOrders={dayOrders} />
      )}

      <PosModals
        branchId={branchId}
        branches={branches}
        products={products}
        promotions={promotions}
        useStock={useStock}
        enableTableNumber={enableTableNumber}
        getStockQty={getStockQty}
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
        payModal={payModal}
        paying={paying}
        onPayOrder={handlePayOrder}
        onClosePayModal={closePayModal}
        addItemsModal={addItemsModal}
        onCloseAddItemsModal={closeAddItemsModal}
        onItemsAdded={handleItemsAdded}
      />
      <ChangePasswordModal
        open={changePassword.open}
        saving={changePassword.saving}
        form={changePassword.form}
        onClose={changePassword.closeModal}
        onSubmit={changePassword.handleSubmit}
      />
    </div>
  );
}
