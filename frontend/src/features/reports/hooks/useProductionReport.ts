"use client";

import { useState, useCallback } from "react";
import { ReportsService } from "../services/reports.service";
import type { ProductionReport } from "../types/reports.types";

const EMPTY: ProductionReport = { ingredients: [], outputs: [] };

export function useProductionReport() {
  const [productionReport, setProductionReport] = useState<ProductionReport>(EMPTY);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (params: string) => {
    setLoading(true);
    const data = await ReportsService.fetchProductionReport(params);
    setProductionReport(data);
    setLoading(false);
  }, []);

  return { productionReport, loading, fetch };
}
