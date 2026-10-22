"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardService } from "../services/dashboard.service";
import type { SalesSummary, TopProduct, DailyData, StockAlert, WarehouseAlert } from "../types/dashboard.types";

export function useDashboard() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [warehouseAlerts, setWarehouseAlerts] = useState<WarehouseAlert[]>([]);
  const [summaryDate, setSummaryDate] = useState<string>("");
  const [showingYesterday, setShowingYesterday] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await DashboardService.getDashboardData();
    setSummary(data.summary);
    setTopProducts(data.topProducts);
    setDailyData(data.dailyData);
    setStockAlerts(data.stockAlerts);
    setWarehouseAlerts(data.warehouseAlerts);
    setSummaryDate(data.summaryDate);
    setShowingYesterday(data.showingYesterday);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { summary, topProducts, dailyData, stockAlerts, warehouseAlerts, summaryDate, showingYesterday, loading, refetch: load };
}
