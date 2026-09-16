"use client";

import { Row, Col, Card, Typography, Skeleton } from "antd";
import { DollarOutlined, FileDoneOutlined, RiseOutlined, ShoppingOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { CashierReport, BranchElaboratedStock } from "../types/reports.types";

const { Text } = Typography;

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  loading: boolean;
}

function StatCard({ label, value, subtitle, icon, color, bg, loading }: StatCardProps) {
  return (
    <Card styles={{ body: { padding: 16 } }}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>
              {label}
            </Text>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: bg,
                color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
              }}
            >
              {icon}
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: "#111827" }}>{value}</div>
          {subtitle && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {subtitle}
            </Text>
          )}
        </>
      )}
    </Card>
  );
}

interface Props {
  cashierReports: CashierReport[];
  branchStock: BranchElaboratedStock[];
  loading: boolean;
}

export function CashierStatsCards({ cashierReports, branchStock, loading }: Props) {
  const t = useTranslations("reports");

  const totalRevenue = cashierReports.reduce((sum, c) => sum + c.total, 0);
  const totalOrders = cashierReports.reduce((sum, c) => sum + c.orders, 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalUnitsSold = cashierReports.reduce(
    (sum, c) => sum + c.items.reduce((s, i) => s + i.qty, 0),
    0
  );
  const totalRemaining = branchStock.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label={t("stats.totalRevenue")}
          value={`Bs ${totalRevenue.toFixed(2)}`}
          subtitle={t("stats.selectedPeriod")}
          icon={<DollarOutlined />}
          color="#16a34a"
          bg="#dcfce7"
          loading={loading}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label={t("stats.totalOrders")}
          value={String(totalOrders)}
          subtitle={t("totalPeriod")}
          icon={<FileDoneOutlined />}
          color="#ea580c"
          bg="#ffedd5"
          loading={loading}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label={t("stats.avgTicket")}
          value={`Bs ${avgTicket.toFixed(2)}`}
          subtitle={t("stats.avgTicketSubtitle")}
          icon={<RiseOutlined />}
          color="#2563eb"
          bg="#dbeafe"
          loading={loading}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label={t("stats.unitsSold")}
          value={String(totalUnitsSold)}
          subtitle={branchStock.length > 0 ? t("branchStock.inStock", { count: totalRemaining }) : undefined}
          icon={<ShoppingOutlined />}
          color="#7c3aed"
          bg="#ede9fe"
          loading={loading}
        />
      </Col>
    </Row>
  );
}
