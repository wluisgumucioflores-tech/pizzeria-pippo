"use client";

import Link from "next/link";
import { Card, Table, Tag, Typography, Space, Button } from "antd";
import { WarningOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { StockAlert } from "../types/reports.types";

const { Text } = Typography;

type ReportsTranslator = ReturnType<typeof useTranslations>;

function buildAlertColumns(t: ReportsTranslator) {
  return [
    {
      title: t("columns.ingredient"),
      key: "ingredient",
      render: (_: unknown, r: StockAlert) => (
        <Space>
          <WarningOutlined style={{ color: "#ef4444" }} />
          <Text>{r.ingredients?.name}</Text>
        </Space>
      ),
    },
    { title: t("columns.unit"), key: "unit", render: (_: unknown, r: StockAlert) => <Tag>{r.ingredients?.unit}</Tag> },
    { title: t("columns.branch"), key: "branch", render: (_: unknown, r: StockAlert) => r.branches?.name },
    {
      title: t("columns.currentStock"),
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number) => <Text style={{ color: "#ef4444", fontWeight: 700 }}>{q}</Text>,
    },
    {
      title: t("columns.minStock"),
      dataIndex: "min_quantity",
      key: "min_quantity",
      render: (m: number) => <Text type="secondary">{m}</Text>,
    },
  ];
}

interface Props {
  stockAlerts: StockAlert[];
}

export function StockAlerts({ stockAlerts }: Props) {
  const t = useTranslations("reports");
  const isMobile = useIsMobile();
  const alertColumns = buildAlertColumns(t);

  if (stockAlerts.length === 0) return null;

  return (
    <Card
      title={
        <Space>
          <WarningOutlined style={{ color: "#ef4444" }} />
          <Text>{t("stockAlerts.title", { count: stockAlerts.length })}</Text>
        </Space>
      }
      size="small"
      extra={
        <Link href="/stock">
          <Button size="small" icon={<ArrowRightOutlined />}>{t("stockAlerts.goToStock")}</Button>
        </Link>
      }
    >
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stockAlerts.map((r) => (
            <div
              key={r.id}
              style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <WarningOutlined style={{ color: "#ef4444" }} />
                  <Text strong style={{ fontSize: 14 }}>{r.ingredients?.name}</Text>
                  <Tag style={{ margin: 0 }}>{r.ingredients?.unit}</Tag>
                </div>
                <Tag color="default" style={{ margin: 0 }}>{r.branches?.name}</Tag>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t("currentShort")}: </Text>
                  <Text strong style={{ color: "#ef4444" }}>{r.quantity}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t("columns.minStock")}: </Text>
                  <Text type="secondary">{r.min_quantity}</Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table dataSource={stockAlerts} columns={alertColumns} rowKey="id" pagination={false} size="small" />
      )}
    </Card>
  );
}
