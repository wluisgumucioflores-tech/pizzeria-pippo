"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { Branch } from "@/features/branches/types/branch.types";
import { useCashSessionsReport } from "./useCashSessionsReport";

export function useCashboxPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf("month"), dayjs()]);
  const { fetch: fetchSessions, sessions, loading } = useCashSessionsReport();

  useEffect(() => {
    BranchesService.getBranches().then(setBranches);
  }, []);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (branchId !== "all") params.set("branchId", branchId);
    params.set("from", dateRange[0].format("YYYY-MM-DD"));
    params.set("to", dateRange[1].format("YYYY-MM-DD"));
    return params.toString();
  }, [branchId, dateRange]);

  const refetch = useCallback(() => fetchSessions(buildParams()), [fetchSessions, buildParams]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    branches,
    branchId,
    setBranchId,
    dateRange,
    setDateRange,
    sessions,
    loading,
    refetch,
  };
}
