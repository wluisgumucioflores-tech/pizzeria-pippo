"use client";

import { memo, useMemo, useCallback } from "react";
import { Select, DatePicker, Button, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { Dayjs } from "dayjs";

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
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
        gap: 12,
      }}
    >
      <Title level={4} style={{ margin: 0 }}>
        {t("title")}
      </Title>

      <Space wrap>

        {presetRanges.map((p) => (
          <Button
            key={p.label}
            size="small"
            onClick={() => onDateRangeChange(p.range)}
          >
            {p.label}
          </Button>
        ))}

        <RangePicker
          value={dateRange}
          onChange={handleRangeChange}
          format="DD/MM/YYYY"
          size="small"
        />

        <Select
          value={selectedBranch}
          onChange={onBranchChange}
          style={{ width: 180 }}
          size="small"
          options={branchOptions}
        />

      </Space>
    </div>
  );
}

export const ReportFilters = memo(ReportFiltersComponent);