"use client";

import { Table, Tag, Space, Button, Tooltip, Spin, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { WarehouseRow } from "../types/warehouse.types";

const { Text } = Typography;

const IconWarning = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconSwap = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);
const IconEdit = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconDelete = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

interface Props {
  rows: WarehouseRow[];
  filteredRows: WarehouseRow[];
  displayMobileRows: WarehouseRow[];
  total: number;
  isLoading: boolean;
  isMobile: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  page: number;
  PAGE_SIZE: number;
  mobileRows: WarehouseRow[];
  sentinelRef: (node: HTMLDivElement | null) => void;
  onPageChange: (p: number) => void;
  onAdjust: (row: WarehouseRow) => void;
  onEditMinQty: (row: WarehouseRow) => void;
  onDelete: (row: WarehouseRow) => void;
}

export function WarehouseTable({
  filteredRows, displayMobileRows, total, isLoading,
  isMobile, loadingMore, hasMore, page, PAGE_SIZE, mobileRows,
  sentinelRef, onPageChange, onAdjust, onEditMinQty, onDelete,
}: Props) {
  const router = useRouter();
  const t = useTranslations("common");
  const tw = useTranslations("warehouse");

  const columns = [
    {
      title: tw("columns.ingredient"),
      key: "ingredient",
      render: (_: unknown, row: WarehouseRow) => (
        <Space>
          {row.quantity < row.min_quantity && (
            <Tooltip title={tw("lowStockTooltip")}><IconWarning /></Tooltip>
          )}
          <Text strong>{row.ingredient_name}</Text>
          <Tag>{row.unit}</Tag>
        </Space>
      ),
    },
    {
      title: tw("columns.warehouseStock"),
      key: "quantity",
      render: (_: unknown, row: WarehouseRow) => (
        <Text strong style={{ color: row.quantity < row.min_quantity ? "#ef4444" : "#16a34a" }}>
          {row.quantity} {row.unit}
        </Text>
      ),
    },
    {
      title: tw("columns.minimum"),
      key: "min_quantity",
      render: (_: unknown, row: WarehouseRow) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onEditMinQty(row)}>
          {row.min_quantity} {row.unit}
        </Button>
      ),
    },
    {
      title: tw("columns.status"),
      key: "status",
      render: (_: unknown, row: WarehouseRow) =>
        row.quantity < row.min_quantity
          ? <Tag color="red">{tw("statusLow")}</Tag>
          : <Tag color="green">{tw("statusOk")}</Tag>,
    },
    {
      title: t("actions"),
      key: "action",
      render: (_: unknown, row: WarehouseRow) => (
        <Space>
          <Button size="small" icon={<IconEdit />} onClick={() => onAdjust(row)}>{tw("adjust")}</Button>
          <Button size="small" icon={<IconSwap />} onClick={() => router.push(`/warehouse/transfer?ingredientId=${row.ingredient_id}`)}>{tw("transfer")}</Button>
          <Tooltip title={row.has_movements ? tw("hasMovementsTooltip") : t("delete")}>
            <Button size="small" danger icon={<IconDelete />} disabled={row.has_movements} onClick={() => onDelete(row)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (isLoading && !filteredRows.length) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spin size="large" /></div>;
  }

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {displayMobileRows.map((row) => {
          const isLow = row.quantity < row.min_quantity;
          return (
            <div key={row.ingredient_id} style={{ background: isLow ? "#fef2f2" : "#fff", border: `1px solid ${isLow ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isLow && <IconWarning />}
                  <Text strong style={{ fontSize: 15 }}>{row.ingredient_name}</Text>
                  <Tag style={{ margin: 0 }}>{row.unit}</Tag>
                </div>
                {isLow ? <Tag color="red" style={{ margin: 0 }}>{tw("statusLow")}</Tag> : <Tag color="green" style={{ margin: 0 }}>{tw("statusOk")}</Tag>}
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{tw("stockLabel")}</Text>
                  <Text strong style={{ color: isLow ? "#ef4444" : "#16a34a" }}>{row.quantity}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{tw("minLabel")}</Text>
                  <Button type="link" size="small" style={{ padding: 0, fontWeight: 600 }} onClick={() => onEditMinQty(row)}>{row.min_quantity}</Button>
                </div>
              </div>
              <Space>
                <Button size="small" icon={<IconEdit />} onClick={() => onAdjust(row)}>{tw("adjust")}</Button>
                <Button size="small" icon={<IconSwap />} onClick={() => router.push(`/warehouse/transfer?ingredientId=${row.ingredient_id}`)}>{tw("transfer")}</Button>
                <Tooltip title={row.has_movements ? tw("hasMovementsTooltip") : t("delete")}>
                  <Button size="small" danger icon={<IconDelete />} disabled={row.has_movements} onClick={() => onDelete(row)} />
                </Tooltip>
              </Space>
            </div>
          );
        })}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}><Spin size="small" /></div>}
        {!hasMore && mobileRows.length > 0 && (
          <Text type="secondary" style={{ textAlign: "center", display: "block", padding: "8px 0", fontSize: 12 }}>
            {tw("totalIngredients", { count: mobileRows.length })}
          </Text>
        )}
      </div>
    );
  }

  return (
    <Table
      dataSource={filteredRows}
      columns={columns}
      rowKey="ingredient_id"
      loading={isLoading}
      pagination={{ current: page, pageSize: PAGE_SIZE, total, showTotal: (count) => tw("totalIngredients", { count }), onChange: onPageChange, showSizeChanger: false }}
      rowClassName={(row) => row.quantity < row.min_quantity ? "bg-red-50" : ""}
      size="middle"
    />
  );
}
