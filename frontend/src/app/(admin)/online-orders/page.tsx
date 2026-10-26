"use client";

import { Alert } from "antd";
import { OnlineOrdersHistoryFilters } from "@/features/online-orders/components/OnlineOrdersHistoryFilters";
import { OnlineOrdersHistoryTable } from "@/features/online-orders/components/OnlineOrdersHistoryTable";
import { useOnlineOrdersHistory } from "@/features/online-orders/hooks/useOnlineOrdersHistory";
import { useRegisterRefresh } from "@/lib/refresh-context";

export default function OnlineOrdersAdminPage() {
  const {
    rows, branches, count, totalAmount, loading, error,
    branchId, setBranchId,
    status, setStatus,
    dateRange, setDateRange,
    page, setPage,
    refetch,
  } = useOnlineOrdersHistory();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <OnlineOrdersHistoryFilters
        branches={branches}
        branchId={branchId}
        status={status}
        dateRange={dateRange}
        count={count}
        totalAmount={totalAmount}
        loading={loading}
        onBranchChange={setBranchId}
        onStatusChange={setStatus}
        onDateRangeChange={setDateRange}
      />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <OnlineOrdersHistoryTable
        rows={rows}
        branches={branches}
        count={count}
        page={page}
        loading={loading}
        onPageChange={setPage}
      />
    </div>
  );
}
