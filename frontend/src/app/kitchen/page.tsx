"use client";

import { KitchenHeader } from "@/features/kitchen/components/KitchenHeader";
import { KitchenEmptyState } from "@/features/kitchen/components/KitchenEmptyState";
import { OrderCard } from "@/features/kitchen/components/OrderCard";
import { useKitchenOrders } from "@/features/kitchen/hooks/useKitchenOrders";
import { useKitchenStageSettings } from "@/features/kitchen/hooks/useKitchenStageSettings";

export default function KitchenPage() {
  const stageSettings = useKitchenStageSettings();
  const {
    orders,
    branchName,
    currentTime,
    connected,
    refreshing,
    pendingCount,
    lateCount,
    handleReady,
    handleLogout,
    handleRefresh,
  } = useKitchenOrders(stageSettings.kitchen_late_threshold_minutes);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <KitchenHeader
        branchName={branchName}
        connected={connected}
        lateCount={lateCount}
        pendingCount={pendingCount}
        currentTime={currentTime}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
      />

      <div className="flex-1 p-6">
        {orders.length === 0 ? (
          <KitchenEmptyState />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReady={handleReady}
                stageSettings={stageSettings}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
