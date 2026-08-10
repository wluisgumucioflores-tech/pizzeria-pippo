"use client";

import { useState } from "react";
import { Table, Tag, Space, Typography, Tooltip } from "antd";
import { WarningOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { UnifiedStockRow } from "../types/stock.types";

const { Text } = Typography;

const MOBILE_PAGE_SIZE = 10;

interface Props {
  stock: UnifiedStockRow[];
  loading: boolean;
  onEditMinQty: (row: UnifiedStockRow) => void;
}

export function UnifiedStockTable({ stock, loading, onEditMinQty }: Props) {
  const isMobile = useIsMobile();
  const [mobilePage, setMobilePage] = useState(1);
  const t = useTranslations("stock");
  const tc = useTranslations("common");

  const columns = [
    {
      title: t("columns.type"),
      key: "origin",
      width: 110,
      filters: [
        { text: t("originIngredient"), value: "insumo" },
        { text: t("originProduct"), value: "reventa" },
      ],
      onFilter: (value: boolean | React.Key, r: UnifiedStockRow) => r.origin === value,
      render: (_: unknown, r: UnifiedStockRow) => (
        <Tag color={r.origin === "insumo" ? "orange" : "blue"}>
          {r.origin === "insumo" ? t("originIngredient") : t("originProduct")}
        </Tag>
      ),
    },
    {
      title: t("columns.nameCombined"),
      key: "name",
      render: (_: unknown, r: UnifiedStockRow) => (
        <Space>
          {r.quantity <= r.min_quantity && (
            <Tooltip title={t("lowStockTooltip")}><WarningOutlined style={{ color: "#ef4444" }} /></Tooltip>
          )}
          <div>
            <Text>{r.name}</Text>
            {r.secondaryName && (
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>{r.secondaryName}</Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: t("columns.unit"),
      key: "unit",
      render: (_: unknown, r: UnifiedStockRow) => <Tag>{r.unit}</Tag>,
    },
    {
      title: t("columns.current"),
      key: "quantity",
      render: (_: unknown, r: UnifiedStockRow) => (
        <Text strong style={{ color: r.quantity <= r.min_quantity ? "#ef4444" : "#16a34a" }}>{r.quantity}</Text>
      ),
    },
    {
      title: t("columns.minimum"),
      key: "min_quantity",
      render: (_: unknown, r: UnifiedStockRow) => (
        <button
          type="button"
          style={{ color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}
          onClick={() => onEditMinQty(r)}
        >
          {r.min_quantity}
        </button>
      ),
    },
    {
      title: t("columns.status"),
      key: "status",
      render: (_: unknown, r: UnifiedStockRow) =>
        r.quantity <= r.min_quantity
          ? <Tag color="red">{t("statusLow")}</Tag>
          : <Tag color="green">{t("statusOk")}</Tag>,
    },
  ];

  if (isMobile) {
    if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>{tc("loading")}</div>;

    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    const pageRows = stock.slice(start, start + MOBILE_PAGE_SIZE);
    const totalPages = Math.ceil(stock.length / MOBILE_PAGE_SIZE);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pageRows.map((r) => {
          const isLow = r.quantity <= r.min_quantity;
          return (
            <div
              key={r.id}
              style={{
                background: isLow ? "#fef2f2" : "#fff",
                border: `1px solid ${isLow ? "#fca5a5" : "#e5e7eb"}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isLow && <WarningOutlined style={{ color: "#ef4444" }} />}
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{r.name}</Text>
                    {r.secondaryName && (
                      <Text type="secondary" style={{ display: "block", fontSize: 12 }}>{r.secondaryName}</Text>
                    )}
                  </div>
                </div>
                {isLow ? <Tag color="red" style={{ margin: 0 }}>{t("statusLow")}</Tag> : <Tag color="green" style={{ margin: 0 }}>{t("statusOk")}</Tag>}
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <Tag color={r.origin === "insumo" ? "orange" : "blue"} style={{ margin: 0 }}>
                  {r.origin === "insumo" ? t("originIngredient") : t("originProduct")}
                </Tag>
                <Tag style={{ margin: 0 }}>{r.unit}</Tag>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t("actualLabel")}</Text>
                  <Text strong style={{ color: isLow ? "#ef4444" : "#16a34a" }}>{r.quantity}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t("minLabel")}</Text>
                  <button
                    type="button"
                    style={{ color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0, fontWeight: 600 }}
                    onClick={() => onEditMinQty(r)}
                  >
                    {r.min_quantity}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              disabled={mobilePage <= 1}
              onClick={() => setMobilePage((p) => p - 1)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: mobilePage <= 1 ? "not-allowed" : "pointer", opacity: mobilePage <= 1 ? 0.5 : 1 }}
            >
              {t("previous")}
            </button>
            <span style={{ lineHeight: "32px", color: "#6b7280", fontSize: 13 }}>{t("pageOf", { page: mobilePage, total: totalPages })}</span>
            <button
              type="button"
              disabled={mobilePage >= totalPages}
              onClick={() => setMobilePage((p) => p + 1)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: mobilePage >= totalPages ? "not-allowed" : "pointer", opacity: mobilePage >= totalPages ? 0.5 : 1 }}
            >
              {t("next")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Table
      dataSource={stock}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10, showTotal: (count) => t("totalItems", { count }) }}
      rowClassName={(r: UnifiedStockRow) => r.quantity <= r.min_quantity ? "bg-red-50" : ""}
      locale={{ emptyText: t("emptyStock") }}
    />
  );
}
