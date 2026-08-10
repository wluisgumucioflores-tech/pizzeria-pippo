"use client";

import Link from "next/link";
import { Row, Col, Card, Statistic } from "antd";
import { useTranslations } from "next-intl";
import type { SalesSummary } from "../types/dashboard.types";

const IconDollar = () => (
  <svg className="inline w-4 h-4" style={{ color: "#f97316" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const IconShopping = () => (
  <svg className="inline w-4 h-4" style={{ color: "#3b82f6" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);

const IconChart = () => (
  <svg className="inline w-4 h-4" style={{ color: "#22c55e" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IconWarning = ({ color }: { color: string }) => (
  <svg className="inline w-4 h-4" style={{ color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconArrow = () => (
  <svg className="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

interface Props {
  summary: SalesSummary | null;
  stockAlertsCount: number;
  loading: boolean;
  showingYesterday?: boolean;
}

export function DashboardSummaryCards({ summary, stockAlertsCount, loading, showingYesterday }: Props) {
  const t = useTranslations("dashboard");
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={showingYesterday ? t("salesYesterday") : t("salesToday")}
            value={summary?.total ?? 0}
            prefix={<IconDollar />}
            suffix="Bs"
            precision={2}
            loading={loading}
            valueStyle={{ color: "#f97316" }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={showingYesterday ? t("ordersYesterday") : t("ordersToday")}
            value={summary?.count ?? 0}
            prefix={<IconShopping />}
            loading={loading}
            valueStyle={{ color: "#3b82f6" }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={t("averageTicket")}
            value={summary?.avg ?? 0}
            prefix={<IconChart />}
            suffix="Bs"
            precision={2}
            loading={loading}
            valueStyle={{ color: "#22c55e" }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={t("stockAlerts")}
            value={stockAlertsCount}
            prefix={<IconWarning color={stockAlertsCount > 0 ? "#ef4444" : "#22c55e"} />}
            loading={loading}
            valueStyle={{ color: stockAlertsCount > 0 ? "#ef4444" : "#22c55e" }}
            suffix={
              stockAlertsCount > 0 ? (
                <Link href="/stock" style={{ marginLeft: 4 }}>
                  <IconArrow />
                </Link>
              ) : null
            }
          />
        </Card>
      </Col>
    </Row>
  );
}
