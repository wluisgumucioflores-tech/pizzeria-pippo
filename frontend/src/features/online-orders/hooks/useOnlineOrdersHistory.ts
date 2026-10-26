"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { BranchesService } from "@/features/branches/services/branches.service";
import { OnlineOrdersService } from "../services/online-orders.service";
import type { Branch } from "@/features/branches/types/branch.types";
import type {
  OnlineOrderRow,
  OnlineOrderStatusFilter,
} from "../types/manage.types";

// Admin history for the QR ordering feature. Separate from useOnlineOrders,
// which drives the cashier's live queue — that one subscribes to sockets and
// only ever holds actionable requests. This one is a plain paginated read.
export function useOnlineOrdersHistory() {
  const [rows, setRows] = useState<OnlineOrderRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("all");
  const [status, setStatus] = useState<OnlineOrderStatusFilter | "all">("all");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs(),
  ]);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await OnlineOrdersService.history(
        {
          branchId: branchId === "all" ? undefined : branchId,
          status: status === "all" ? undefined : status,
          from: dateRange[0].format("YYYY-MM-DD"),
          to: dateRange[1].format("YYYY-MM-DD"),
        },
        page,
      );
      setRows(history.items);
      setCount(history.count);
      setTotalAmount(history.total_amount);
    } catch (err) {
      // Surfaced rather than swallowed: an empty table with a Bs 0.00 total
      // would read as "nobody ordered" instead of "the request failed".
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
      setRows([]);
      setCount(0);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  }, [branchId, status, dateRange, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // The branch list never changes with the filters, so it loads once.
  useEffect(() => {
    BranchesService.getBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  // Any filter change invalidates the current page number — staying on page 4
  // of a result set that now has one page would show an empty table.
  const resetToFirstPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return {
    rows,
    branches,
    count,
    totalAmount,
    loading,
    error,
    branchId,
    setBranchId: resetToFirstPage(setBranchId),
    status,
    setStatus: resetToFirstPage(setStatus),
    dateRange,
    setDateRange: resetToFirstPage(setDateRange),
    page,
    setPage,
    refetch: load,
  };
}
