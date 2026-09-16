"use client";

import { Card, Space, Typography, Avatar, Collapse, Table, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { CashierReport, TopProduct } from "../types/reports.types";

const { Text } = Typography;

type ReportsTranslator = ReturnType<typeof useTranslations>;

function buildCashierItemColumns(t: ReportsTranslator, categoryLabel: (categoryId: string | null) => string) {
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
      dataIndex: "category_id",
      key: "category_id",
      render: (categoryId: string | null) => <Tag>{categoryLabel(categoryId)}</Tag>,
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

interface Props {
  cashier: CashierReport;
  loading: boolean;
  subtitle: string;
  categoryLabel: (categoryId: string | null) => string;
}

export function CashierBreakdownCard({ cashier: c, loading, subtitle, categoryLabel }: Props) {
  const t = useTranslations("reports");
  const isMobile = useIsMobile();
  const itemColumns = buildCashierItemColumns(t, categoryLabel);
  const sortedItems = c.items.slice().sort((a, b) => b.qty - a.qty);

  return (
    <div>
      <Card
        loading={loading}
        size="small"
        style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px 8px 0 0" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space>
            <Avatar size={40} icon={<UserOutlined />} style={{ backgroundColor: "#f97316" }} />
            <Space direction="vertical" size={0}>
              <Text strong style={{ fontSize: 15 }}>{c.cashier_name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>
            </Space>
          </Space>
          <Space size={32}>
            <Space direction="vertical" size={0} align="end">
              <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase" }}>{t("cashier.totalSales")}</Text>
              <Text strong style={{ fontSize: 18, color: "#f97316" }}>Bs {c.total.toFixed(2)}</Text>
            </Space>
            <Space direction="vertical" size={0} align="end">
              <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase" }}>{t("cashier.ordersAttended")}</Text>
              <Text strong style={{ fontSize: 18 }}>{c.orders}</Text>
            </Space>
          </Space>
        </div>
      </Card>

      <Collapse
        style={{ borderRadius: "0 0 8px 8px" }}
        items={[
          {
            key: c.cashier_id,
            label: <Text type="secondary">{t("cashier.ordersRegistered", { count: c.orders })}</Text>,
            extra: (
              <Text style={{ color: "#f97316", fontWeight: 600 }}>
                {t("columns.subtotal")}: Bs {c.total.toFixed(2)}
              </Text>
            ),
            children: isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedItems.map((r) => (
                  <div key={r.variant_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f9fafb", borderRadius: 8 }}>
                    <div>
                      <Text strong style={{ fontSize: 13, display: "block" }}>{r.product_name}</Text>
                      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>{r.variant_name}</Text>
                        <Tag style={{ margin: 0, fontSize: 10, lineHeight: "16px" }}>{categoryLabel(r.category_id)}</Tag>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Text strong style={{ color: "#f97316", display: "block" }}>Bs {r.revenue.toFixed(2)}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{r.qty} {t("unitsShort")}</Text>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table dataSource={sortedItems} columns={itemColumns} rowKey="variant_id" pagination={false} size="small" />
            ),
          },
        ]}
      />
    </div>
  );
}
