"use client";

import { useEffect, useCallback } from "react";
import { useReportFilters } from "./useReportFilters";
import { useSalesReport } from "./useSalesReport";
import { useCashierReport } from "./useCashierReport";
import { useProductionReport } from "./useProductionReport";
import { useOrdersReport } from "./useOrdersReport";
import { useOrderCancellation } from "./useOrderCancellation";

export function useReportsPage() {
  const filters = useReportFilters();
  const sales = useSalesReport();
  const cashier = useCashierReport();
  const production = useProductionReport();
  const ordersReport = useOrdersReport();
  const cancellation = useOrderCancellation(() => ordersReport.fetch(filters.buildParams(), ordersReport.ordersPage));

  const { buildParams, selectedBranch, activeTab } = filters;

  // Re-fetches only the active tab's data — shared by the tab-switch effect
  // below and the header's manual refresh button (useRegisterRefresh).
  const refetchActiveTab = useCallback(() => {
    const params = buildParams();
    if (activeTab === "general") sales.fetch(params, selectedBranch);
    if (activeTab === "cajeros") cashier.fetch(params);
    if (activeTab === "produccion") production.fetch(params);
    if (activeTab === "ventas") {
      sales.fetch(params, selectedBranch);
      ordersReport.setOrdersPage(1);
      ordersReport.fetch(params, 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedBranch, buildParams]);

  useEffect(() => {
    refetchActiveTab();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedBranch, filters.dateRange]);

  return { filters, sales, cashier, production, ordersReport, cancellation, refetch: refetchActiveTab };
}
