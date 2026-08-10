"use client";

import { Table, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { TYPE_COLORS, getTypeLabels } from "../constants/stock.constants";
import type { Movement } from "../types/stock.types";

const { Text } = Typography;

interface Props {
  movements: Movement[];
  loading: boolean;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function StockMovementsTable({ movements, loading, page, total, pageSize, onPageChange }: Props) {
  const t = useTranslations("stock");
  const tm = useTranslations("stock.movementTypes");
  const TYPE_LABELS = getTypeLabels(tm);

  const columns = [
    {
      title: t("columns.date"),
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => new Date(d).toLocaleString("es-BO"),
    },
    {
      title: t("columns.ingredient"),
      key: "ingredient",
      render: (_: unknown, r: Movement) => r.ingredients?.name ?? r.ingredient_id,
    },
    {
      title: t("columns.type"),
      dataIndex: "type",
      key: "type",
      render: (type: string) => <Tag color={TYPE_COLORS[type]}>{TYPE_LABELS[type] ?? type}</Tag>,
    },
    {
      title: t("columns.quantity"),
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number) => (
        <Text className={q >= 0 ? "text-green-600" : "text-red-500"}>
          {q >= 0 ? `+${q}` : q}
        </Text>
      ),
    },
    {
      title: t("columns.notes"),
      dataIndex: "notes",
      key: "notes",
      render: (n: string | null) => n ?? "—",
    },
  ];

  return (
    <Table
      dataSource={movements}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={{
        current: page,
        pageSize,
        total,
        showTotal: (count) => t("totalMovements", { count }),
        onChange: onPageChange,
        showSizeChanger: false,
      }}
    />
  );
}
