"use client";

import { CashboxFilters } from "@/features/cashbox/components/CashboxFilters";
import { CashSessionAdminControl } from "@/features/cashbox/components/CashSessionAdminControl";
import { CashSessionsReportTable } from "@/features/cashbox/components/CashSessionsReportTable";
import { useCashboxPage } from "@/features/cashbox/hooks/useCashboxPage";
import { useRegisterRefresh } from "@/lib/refresh-context";

export default function CashboxPage() {
  const { branches, branchId, setBranchId, dateRange, setDateRange, sessions, loading, refetch } = useCashboxPage();
  useRegisterRefresh(refetch);
  const branchLabel = branches.find((b) => b.id === branchId)?.name;

  return (
    <div className="p-6">
      <CashboxFilters
        branches={branches}
        branchId={branchId}
        dateRange={dateRange}
        onBranchChange={setBranchId}
        onDateRangeChange={setDateRange}
      />
      <CashSessionAdminControl branchId={branchId} branchLabel={branchLabel} onChanged={refetch} />
      <CashSessionsReportTable sessions={sessions} loading={loading} />
    </div>
  );
}
