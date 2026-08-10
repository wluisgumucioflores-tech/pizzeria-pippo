"use client";

import { Input, Select } from "antd";
import { useTranslations } from "next-intl";
import { WarehouseTable } from "./WarehouseTable";
import { IconSearch } from "./WarehouseIcons";
import type { WarehouseRow } from "../types/warehouse.types";

interface Props {
  isMobile: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filterStatus: "low" | "ok" | undefined;
  onStatusFilterChange: (value: "low" | "ok" | undefined) => void;
  filteredRows: WarehouseRow[];
  displayMobileRows: WarehouseRow[];
  mobileRows: WarehouseRow[];
  total: number;
  isLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  page: number;
  pageSize: number;
  sentinelRef: (node: HTMLDivElement | null) => void;
  onPageChange: (page: number) => void;
  onAdjust: (row: WarehouseRow) => void;
  onEditMinQty: (row: WarehouseRow) => void;
  onDelete: (row: WarehouseRow) => void;
}

export function WarehouseIngredientsTab({
  isMobile, search, onSearchChange, filterStatus, onStatusFilterChange,
  filteredRows, displayMobileRows, mobileRows, total, isLoading, loadingMore, hasMore,
  page, pageSize, sentinelRef, onPageChange, onAdjust, onEditMinQty, onDelete,
}: Props) {
  const t = useTranslations("warehouse");

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Input
          placeholder={t("searchIngredient")}
          prefix={<IconSearch />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ width: isMobile ? "100%" : 220 }}
        />
        <Select
          placeholder={t("status")}
          allowClear
          value={filterStatus}
          onChange={onStatusFilterChange}
          style={{ width: isMobile ? "100%" : 140 }}
          options={[{ value: "low", label: t("statusLow") }, { value: "ok", label: t("statusOk") }]}
        />
      </div>
      <WarehouseTable
        rows={filteredRows}
        filteredRows={filteredRows}
        displayMobileRows={displayMobileRows}
        total={total}
        isLoading={isLoading}
        isMobile={isMobile}
        loadingMore={loadingMore}
        hasMore={hasMore}
        page={page}
        PAGE_SIZE={pageSize}
        mobileRows={mobileRows}
        sentinelRef={sentinelRef}
        onPageChange={onPageChange}
        onAdjust={onAdjust}
        onEditMinQty={onEditMinQty}
        onDelete={onDelete}
      />
    </>
  );
}
