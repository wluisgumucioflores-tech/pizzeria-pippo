"use client";

import { Button, Input, Select, Tag } from "antd";
import { FileExcelOutlined, SearchOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Branch } from "../types/stock.types";

const IconWarning = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

interface Props {
  isMobile: boolean;
  alertCount: number;
  branches: Branch[];
  selectedBranch: string;
  onSelectedBranchChange: (branchId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  exporting: boolean;
  onExport: () => void;
  exportDisabled: boolean;
}

export function StockPageHeader({
  isMobile, alertCount, branches, selectedBranch, onSelectedBranchChange,
  search, onSearchChange, exporting, onExport, exportDisabled,
}: Props) {
  const t = useTranslations("stock");

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 className="text-lg font-semibold m-0">{t("title")}</h2>
        {alertCount > 0 && (
          <Tag color="red" icon={<IconWarning />}>
            {t("lowStockAlert", { count: alertCount })}
          </Tag>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
        <Input
          placeholder={t("searchPlaceholder")}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ width: isMobile ? "100%" : 220 }}
        />
        <Select
          value={selectedBranch}
          onChange={onSelectedBranchChange}
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
          style={{ width: isMobile ? "100%" : 200 }}
          placeholder={t("selectBranchPlaceholder")}
        />
        <Button
          icon={<FileExcelOutlined />}
          loading={exporting}
          disabled={exportDisabled}
          onClick={onExport}
          style={{ width: isMobile ? "100%" : undefined }}
        >
          {t("exportExcel")}
        </Button>
      </div>
    </div>
  );
}
