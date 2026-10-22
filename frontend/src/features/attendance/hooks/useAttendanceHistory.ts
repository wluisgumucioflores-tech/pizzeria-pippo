"use client";

import { useState, useEffect, useCallback } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { AttendanceHistoryService } from "../services/attendance-history.service";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { Branch } from "@/features/branches/types/branch.types";
import type { AttendanceRecord } from "../types/attendance.types";

export function useAttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf("month"), dayjs()]);

  const load = useCallback(async () => {
    setLoading(true);
    const [historyData, branchList] = await Promise.all([
      AttendanceHistoryService.getHistory({
        branchId: selectedBranch === "all" ? undefined : selectedBranch,
        from: dateRange[0].format("YYYY-MM-DD"),
        to: dateRange[1].format("YYYY-MM-DD"),
      }),
      BranchesService.getBranches(),
    ]);
    setRecords(historyData);
    setBranches(branchList);
    setLoading(false);
  }, [selectedBranch, dateRange]);

  useEffect(() => { load(); }, [load]);

  const expectedStartTime = branches.find((b) => b.id === selectedBranch)?.expected_start_time ?? null;

  return { records, branches, loading, selectedBranch, setSelectedBranch, dateRange, setDateRange, expectedStartTime, refetch: load };
}
