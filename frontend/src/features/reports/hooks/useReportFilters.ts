"use client";

import { useState, useEffect } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { ReportsService } from "../services/reports.service";
import type { Branch } from "../types/reports.types";

type Translate = (key: string) => string;

export function getPresetRanges(t: Translate): { label: string; range: [Dayjs, Dayjs] }[] {
  return [
    { label: t("today"), range: [dayjs(), dayjs()] },
    { label: t("thisWeek"), range: [dayjs().startOf("week"), dayjs()] },
    { label: t("thisMonth"), range: [dayjs().startOf("month"), dayjs()] },
  ];
}

export function useReportFilters() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf("month"), dayjs()]);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    ReportsService.getBranches().then(setBranches);
  }, []);

  const buildParams = () =>
    ReportsService.buildParams(
      selectedBranch,
      dateRange[0].format("YYYY-MM-DD"),
      dateRange[1].format("YYYY-MM-DD")
    );

  return {
    branches,
    selectedBranch, setSelectedBranch,
    dateRange, setDateRange,
    activeTab, setActiveTab,
    buildParams,
  };
}
