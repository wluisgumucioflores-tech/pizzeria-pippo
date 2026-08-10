"use client";

import dayjs from "dayjs";
import dynamic from "next/dynamic";
import { Button, Alert } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { DashboardSummaryCards } from "@/features/dashboard/components/DashboardSummaryCards";
import { DashboardStockAlerts } from "@/features/dashboard/components/DashboardStockAlerts";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";

const DashboardCharts = dynamic(
  () => import("@/features/dashboard/components/DashboardCharts").then((m) => m.DashboardCharts),
  { ssr: false }
);

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const { summary, topProducts, dailyData, stockAlerts, warehouseAlerts, summaryDate, showingYesterday, loading } = useDashboard();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 className="text-lg font-semibold m-0">{tNav("dashboard")}</h2>
          <p className="text-gray-400 text-sm mt-0.5">{t("subtitle", { date: dayjs().format("dddd, D [de] MMMM YYYY") })}</p>
        </div>
        <Button
          type="primary"
          icon={<ShoppingCartOutlined />}
          href="/pos"
          target="_blank"
          style={{ background: "#ea580c", borderColor: "#ea580c" }}
        >
          {t("goToPos")}
        </Button>
      </div>

      {!loading && showingYesterday && (
        <Alert
          type="info"
          showIcon
          message={t("noSalesTodayAlert")}
          description={t("showingYesterdayAlert", { date: dayjs(summaryDate).format("dddd D [de] MMMM") })}
          style={{ marginBottom: 16 }}
        />
      )}

      <DashboardSummaryCards
        summary={summary}
        stockAlertsCount={stockAlerts.length + warehouseAlerts.length}
        loading={loading}
        showingYesterday={showingYesterday}
      />

      <DashboardCharts
        dailyData={dailyData}
        topProducts={topProducts}
        loading={loading}
        showingYesterday={showingYesterday}
      />

      <DashboardStockAlerts
        stockAlerts={stockAlerts}
        warehouseAlerts={warehouseAlerts}
      />
    </div>
  );
}
