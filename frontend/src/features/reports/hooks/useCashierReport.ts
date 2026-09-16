"use client";

import { useState, useCallback } from "react";
import { ReportsService } from "../services/reports.service";
import type { CashierReport, BranchElaboratedStock } from "../types/reports.types";

export function useCashierReport() {
  const [cashierReports, setCashierReports] = useState<CashierReport[]>([]);
  const [branchStock, setBranchStock] = useState<BranchElaboratedStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetch = useCallback(async (params: string) => {
    setLoading(true);
    const { cashiers, branchStock } = await ReportsService.fetchCashierReports(params);
    setCashierReports(cashiers);
    setBranchStock(branchStock);
    setLastUpdatedAt(new Date());
    setLoading(false);
  }, []);

  return { cashierReports, branchStock, loading, lastUpdatedAt, fetch };
}
