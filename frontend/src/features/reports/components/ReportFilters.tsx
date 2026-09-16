"use client";

import { memo, useMemo, useCallback } from "react";
import { Select, DatePicker, Button, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { Dayjs } from "dayjs";
import { useIsMobile } from "@/lib/useIsMobile";

import { getPresetRanges } from "../hooks/useReportFilters";
import type { Branch } from "../types/reports.types";

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface Props {
  branches: Branch[];
  selectedBranch: string;
  dateRange: [Dayjs, Dayjs];
  onBranchChange: (val: string) => void;
  onDateRangeChange: (range: [Dayjs, Dayjs]) => void;
}

function ReportFiltersComponent({
  branches,
  selectedBranch,
  dateRange,
  onBranchChange,
  onDateRangeChange,
}: Props) {
  const t = useTranslations("reports");
  const isMobile = useIsMobile();

  const branchOptions = useMemo(() => {
    return [
      { value: "all", label: t("allBranches") },
      ...branches.map((b) => ({
        value: b.id,
        label: b.name,
      })),
    ];
  }, [branches, t]);

  const presetRanges = useMemo(() => getPresetRanges(t), [t]);

  const handleRangeChange = useCallback(
    (dates: null | (Dayjs | null)[]) => {
      if (dates?.[0] && dates?.[1]) {
        onDateRangeChange([dates[0], dates[1]]);
      }
    },
    [onDateRangeChange]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: isMobile ? "stretch" : "center",
        marginBottom: 24,
        gap: 12,
      }}
    >
      <Title level={4} style={{ margin: 0 }}>
        {t("title")}
      </Title>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          flexWrap: "wrap",
          alignItems: isMobile ? "stretch" : "center",
          gap: 8,
        }}
      >
        <Space wrap size={8}>
          {presetRanges.map((p) => (
            <Button
              key={p.label}
              size="small"
              onClick={() => onDateRangeChange(p.range)}
            >
              {p.label}
            </Button>
          ))}
        </Space>

        <RangePicker
          value={dateRange}
          onChange={handleRangeChange}
          format="DD/MM/YYYY"
          size="small"
          style={isMobile ? { width: "100%" } : undefined}
        />

        <Select
          value={selectedBranch}
          onChange={onBranchChange}
          style={isMobile ? { width: "100%" } : { width: 180 }}
          size="small"
          options={branchOptions}
        />
      </div>
    </div>
  );
}

export const ReportFilters = memo(ReportFiltersComponent);