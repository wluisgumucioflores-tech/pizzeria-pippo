"use client";

import { Row, Col, Card, Statistic, Space, Typography, Avatar, Collapse, Table, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { useCategoryOptions } from "@/features/categories/hooks/useCategoryOptions";
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
  cashierReports: CashierReport[];
  loading: boolean;
}

export function CashierReportTable({ cashierReports, loading }: Props) {
  const t = useTranslations("reports");
  const isMobile = useIsMobile();
  const { options: categoryOptions } = useCategoryOptions();
  const categoryLabel = (categoryId: string | null) =>
    categoryOptions.find((c) => c.value === categoryId)?.label ?? "—";
  const cashierItemColumns = buildCashierItemColumns(t, categoryLabel);

  if (cashierReports.length === 0 && !loading) {
    return (
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "#9ca3af" }}>
          {t("summary.noSalesPeriod")}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {cashierReports.map((c) => (
          <Col xs={24} sm={12} lg={8} key={c.cashier_id}>
            <Card loading={loading}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space>
                  <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#f97316" }} />
                  <Text strong style={{ fontSize: 15 }}>{c.cashier_name}</Text>
                </Space>
                <Row gutter={8}>
                  <Col span={12}>
                    <Statistic title={t("cashier.sales")} value={c.total} suffix="Bs" precision={2} valueStyle={{ color: "#f97316", fontSize: 18 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title={t("cashier.orders")} value={c.orders} valueStyle={{ fontSize: 18 }} />
                  </Col>
                </Row>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Collapse
        accordion
        items={cashierReports.map((c) => ({
          key: c.cashier_id,
          label: (
            <Space wrap>
              <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: "#f97316" }} />
              <Text strong>{c.cashier_name}</Text>
              <Text type="secondary">— {t("cashier.ordersCount", { count: c.orders })}</Text>
              <Text style={{ color: "#f97316", fontWeight: 600 }}>Bs {c.total.toFixed(2)}</Text>
            </Space>
          ),
          children: isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.items.sort((a, b) => b.qty - a.qty).map((r) => (
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
            <Table
              dataSource={c.items.sort((a, b) => b.qty - a.qty)}
              columns={cashierItemColumns}
              rowKey="variant_id"
              pagination={false}
              size="small"
            />
          ),
        }))}
      />
    </>
  );
}
