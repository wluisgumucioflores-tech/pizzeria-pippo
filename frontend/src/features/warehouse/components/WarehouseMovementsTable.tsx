"use client";

import { Table, Typography, Tag, Space } from "antd";
import { useTranslations } from "next-intl";
import { MOVEMENT_TYPE_COLORS, getMovementTypeLabels } from "../types/warehouse-movements.types";
import type { UnifiedMovement } from "../types/warehouse-movements.types";

const { Text } = Typography;

interface Props {
  movements: UnifiedMovement[];
  loading: boolean;
}

export function WarehouseMovementsTable({ movements, loading }: Props) {
  const t = useTranslations("warehouse.movements");
  const MOVEMENT_TYPE_LABELS = getMovementTypeLabels(t);

  const columns = [
    {
      title: t("columns.date"),
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => new Date(d).toLocaleString("es-BO"),
    },
    {
      title: t("columns.type"),
      dataIndex: "type",
      key: "type",
      render: (type: string) => <Tag color={MOVEMENT_TYPE_COLORS[type]}>{MOVEMENT_TYPE_LABELS[type] ?? type}</Tag>,
    },
    {
      title: t("columns.origin"),
      dataIndex: "origin",
      key: "origin",
      render: (o: "ingredient" | "product") =>
        o === "ingredient"
          ? <Tag color="default">{t("originIngredient")}</Tag>
          : <Tag color="purple">{t("originProduct")}</Tag>,
    },
    {
      title: t("columns.detail"),
      key: "detail",
      render: (_: unknown, r: UnifiedMovement) => (
        <Space>
          <Text>{r.detailName}</Text>
          {r.unit && <Tag>{r.unit}</Tag>}
        </Space>
      ),
    },
    {
      title: t("columns.quantity"),
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number, r: UnifiedMovement) => {
        const display = r.type === "compra" || q >= 0 ? `+${q}` : `${q}`;
        return <Text style={{ color: q >= 0 ? "#16a34a" : "#ef4444" }}>{display} {r.unit}</Text>;
      },
    },
    {
      title: t("columns.destination"),
      key: "branch",
      render: (_: unknown, r: UnifiedMovement) =>
        r.branches ? <Tag>{r.branches.name}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: t("columns.notes"),
      dataIndex: "notes",
      key: "notes",
      render: (n: string | null) => n ?? <Text type="secondary">—</Text>,
    },
  ];

  return <Table dataSource={movements} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 30 }} />;
}
