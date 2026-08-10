"use client";

import { Table, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { getTypeLabels } from "../constants/stock.constants";
import type { UnifiedMovement } from "../types/stock.types";

const { Text } = Typography;

const TYPE_COLORS: Record<string, string> = {
  compra: "green",
  venta: "blue",
  ajuste: "orange",
  anulacion: "red",
};

interface Props {
  movements: UnifiedMovement[];
  loading: boolean;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function StockHistoryTable({ movements, loading, page, total, pageSize, onPageChange }: Props) {
  const t = useTranslations("stock");
  const tm = useTranslations("stock.movementTypes");
  const TYPE_LABELS = getTypeLabels(tm);

  const columns = [
    {
      title: t("columns.date"),
      dataIndex: "created_at",
      key: "created_at",
      render: (val: string) => new Date(val).toLocaleString("es-BO"),
    },
    {
      title: t("columns.detail"),
      key: "detail",
      render: (_: unknown, row: UnifiedMovement) => (
        <div>
          <Text>{row.detail}</Text>
          <Tag style={{ marginLeft: 6 }} color={row.origin === "insumo" ? "purple" : "cyan"}>
            {row.origin === "insumo" ? t("originIngredientShort") : t("originProductShort")}
          </Tag>
        </div>
      ),
    },
    {
      title: t("columns.quantity"),
      dataIndex: "quantity",
      key: "quantity",
      render: (val: number) => (
        <Text style={{ color: val >= 0 ? "#16a34a" : "#dc2626" }}>
          {val >= 0 ? "+" : ""}{val}
        </Text>
      ),
    },
    {
      title: t("columns.type"),
      dataIndex: "type",
      key: "type",
      render: (val: string) => <Tag color={TYPE_COLORS[val] ?? "default"}>{TYPE_LABELS[val] ?? val}</Tag>,
    },
    {
      title: t("columns.notes"),
      dataIndex: "notes",
      key: "notes",
      render: (val: string | null) => val ? <Text type="secondary">{val}</Text> : "—",
    },
  ];

  return (
    <Table
      rowKey="id"
      dataSource={movements}
      columns={columns}
      loading={loading}
      pagination={{ current: page, total, pageSize, onChange: onPageChange, showSizeChanger: false }}
    />
  );
}
