"use client";

import { Card, Table, Tag, Typography, Space } from "antd";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { TopProduct } from "../types/reports.types";

const { Text } = Typography;

interface Props {
  topProducts: TopProduct[];
  loading: boolean;
}

const CATEGORY_COLOR: Record<string, string> = {
  pizza: "red", bebida: "blue", otro: "green",
};

type ReportsTranslator = ReturnType<typeof useTranslations>;

function buildColumns(t: ReportsTranslator) {
  return [
    {
      title: t("columns.product"),
      key: "product",
      render: (_: unknown, r: TopProduct) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.product_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.variant_name}</Text>
        </Space>
      ),
    },
    {
      title: t("columns.category"),
      dataIndex: "category",
      key: "category",
      render: (cat: string) => <Tag color={CATEGORY_COLOR[cat] ?? "default"}>{cat}</Tag>,
    },
    {
      title: t("columns.units"),
      dataIndex: "qty",
      key: "qty",
      sorter: (a: TopProduct, b: TopProduct) => b.qty - a.qty,
      render: (qty: number) => <Text strong>{qty}</Text>,
    },
    {
      title: t("columns.revenue"),
      dataIndex: "revenue",
      key: "revenue",
      sorter: (a: TopProduct, b: TopProduct) => b.revenue - a.revenue,
      render: (rev: number) => <Text strong style={{ color: "#f97316" }}>Bs {rev.toFixed(2)}</Text>,
    },
  ];
}

export function TopProductsTable({ topProducts, loading }: Props) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const isMobile = useIsMobile();
  const columns = buildColumns(t);

  return (
    <Card title={t("topProducts")} size="small" style={{ marginBottom: 24 }}>
      {isMobile ? (
        loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>{tc("loading")}</div>
        ) : topProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>{t("summary.noDataPeriod")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topProducts.map((r, i) => (
              <div
                key={r.variant_id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#f9fafb", borderRadius: 8, gap: 8 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <Text type="secondary" style={{ fontSize: 13, flexShrink: 0, width: 20, textAlign: "center" }}>#{i + 1}</Text>
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.product_name}</Text>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{r.variant_name}</Text>
                      <Tag color={CATEGORY_COLOR[r.category] ?? "default"} style={{ margin: 0, fontSize: 10, lineHeight: "16px" }}>{r.category}</Tag>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <Text strong style={{ color: "#f97316", display: "block", fontSize: 14 }}>Bs {r.revenue.toFixed(2)}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.qty} {t("unitsShort")}</Text>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <Table
          dataSource={topProducts}
          columns={columns}
          rowKey="variant_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      )}
    </Card>
  );
}
