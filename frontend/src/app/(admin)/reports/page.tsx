"use client";

import dynamic from "next/dynamic";
import { Tabs, Space } from "antd";
import { UnorderedListOutlined, UserOutlined, ShoppingOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

import { ReportFilters } from "@/features/reports/components/ReportFilters";
import { ReportsGeneralTab } from "@/features/reports/components/ReportsGeneralTab";
import { ReportsOrdersTab } from "@/features/reports/components/ReportsOrdersTab";
import { CancelOrderModal } from "@/features/pos/components/CancelOrderModal";
import { useReportsPage } from "@/features/reports/hooks/useReportsPage";
import { useRegisterRefresh } from "@/lib/refresh-context";

const CashierReportTable = dynamic(() =>
  import("@/features/reports/components/CashierReportTable").then(m => m.CashierReportTable)
);
const CashierStatsCards = dynamic(() =>
  import("@/features/reports/components/CashierStatsCards").then(m => m.CashierStatsCards)
);
const ProductionReportTable = dynamic(() =>
  import("@/features/reports/components/ProductionReportTable").then(m => m.ProductionReportTable)
);

export default function ReportsPage() {
  const t = useTranslations("reports");
  const { filters, sales, cashier, production, ordersReport, cancellation, refetch } = useReportsPage();
  useRegisterRefresh(refetch);
  const selectedBranchLabel = filters.branches.find((b) => b.id === filters.selectedBranch)?.name;

  return (
    <div style={{ padding: 24 }}>
      <ReportFilters
        branches={filters.branches}
        selectedBranch={filters.selectedBranch}
        dateRange={filters.dateRange}
        onBranchChange={filters.setSelectedBranch}
        onDateRangeChange={filters.setDateRange}
      />

      <Tabs
        activeKey={filters.activeTab}
        onChange={filters.setActiveTab}
        items={[
          {
            key: "general",
            label: t("tabs.general"),
            children: <ReportsGeneralTab sales={sales} />,
          },
          {
            key: "ventas",
            label: <Space><UnorderedListOutlined />{t("tabs.sales")}</Space>,
            children: (
              <ReportsOrdersTab
                ordersReport={ordersReport}
                summary={sales.summary}
                buildParams={filters.buildParams}
                onCancel={cancellation.openCancelModal}
              />
            ),
          },
          {
            key: "cajeros",
            label: <Space><UserOutlined />{t("tabs.cashiers")}</Space>,
            children: (
              <>
                <CashierStatsCards cashierReports={cashier.cashierReports} branchStock={cashier.branchStock} loading={cashier.loading} />
                <CashierReportTable
                  cashierReports={cashier.cashierReports}
                  branchStock={cashier.branchStock}
                  loading={cashier.loading}
                  branchLabel={selectedBranchLabel}
                  lastUpdatedAt={cashier.lastUpdatedAt}
                />
              </>
            ),
          },
          ...(filters.enabledModules.produccion
            ? [
                {
                  key: "produccion",
                  label: <Space><ShoppingOutlined />{t("tabs.production")}</Space>,
                  children: <ProductionReportTable productionReport={production.productionReport} loading={production.loading} />,
                },
              ]
            : []),
        ]}
      />
      <CancelOrderModal
        order={cancellation.cancelModal}
        loading={cancellation.cancelling}
        onConfirm={cancellation.handleCancel}
        onClose={cancellation.closeCancelModal}
      />
    </div>
  );
}
