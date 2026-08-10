"use client";

import Link from "next/link";
import { Row, Col, Card, Space, Table, Typography, Tag } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { TopProduct, DailyData } from "../types/dashboard.types";

const { Text } = Typography;

const IconFire = () => (
  <svg className="inline w-4 h-4" style={{ color: "#f97316" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
);

const IconArrow = () => (
  <svg className="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

type DashboardTranslator = ReturnType<typeof useTranslations>;

function buildTopColumns(t: DashboardTranslator) {
  return [
    {
      title: t("columns.product"),
      key: "product",
      render: (_: unknown, r: TopProduct) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.product_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.variant_name}</Text>
        </Space>
      ),
    },
    {
      title: t("columns.category"),
      dataIndex: "category",
      key: "category",
      render: (cat: string) => (
        <Tag color={cat === "pizza" ? "red" : cat === "bebida" ? "blue" : "green"}>{cat}</Tag>
      ),
    },
    {
      title: t("columns.units"),
      dataIndex: "qty",
      key: "qty",
      render: (qty: number) => <Text strong>{qty}</Text>,
    },
    {
      title: t("columns.revenue"),
      dataIndex: "revenue",
      key: "revenue",
      render: (rev: number) => (
        <Text strong style={{ color: "#f97316" }}>Bs {rev.toFixed(2)}</Text>
      ),
    },
  ];
}

interface Props {
  dailyData: DailyData[];
  topProducts: TopProduct[];
  loading: boolean;
  showingYesterday?: boolean;
}

export function DashboardCharts({ dailyData, topProducts, loading, showingYesterday }: Props) {
  const t = useTranslations("dashboard");
  const topColumns = buildTopColumns(t);
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} lg={14}>
        <Card
          title={t("salesLast7Days")}
          size="small"
          extra={
            <Link href="/reports" className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600">
              {t("viewReports")} <IconArrow />
            </Link>
          }
        >
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => dayjs(d).format("DD/MM")}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`Bs ${Number(v).toFixed(2)}`, t("sales")]}
                  labelFormatter={(d) => dayjs(d).format("DD/MM/YYYY")}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "#94a3b8" }}>
              {t("noSalesLast7Days")}
            </div>
          )}
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Card
          title={
            <Space>
              <IconFire />
              {showingYesterday ? t("top5Yesterday") : t("top5Today")}
            </Space>
          }
          size="small"
          style={{ height: "100%" }}
        >
          {topProducts.length > 0 ? (
            <Table
              dataSource={topProducts}
              columns={topColumns}
              rowKey="variant_id"
              loading={loading}
              pagination={false}
              size="small"
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "#94a3b8" }}>
              {showingYesterday ? t("noSalesYesterday") : t("noSalesToday")}
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
}
