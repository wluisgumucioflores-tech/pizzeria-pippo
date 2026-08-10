"use client";

import dynamic from "next/dynamic";
import { Tabs, Space } from "antd";
import { UnorderedListOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

import { ReportFilters } from "@/features/reports/components/ReportFilters";
import { ReportsGeneralTab } from "@/features/reports/components/ReportsGeneralTab";
import { ReportsOrdersTab } from "@/features/reports/components/ReportsOrdersTab";
import { CancelOrderModal } from "@/features/pos/components/CancelOrderModal";
import { useReportsPage } from "@/features/reports/hooks/useReportsPage";

const CashierReportTable = dynamic(() =>
  import("@/features/reports/components/CashierReportTable").then(m => m.CashierReportTable)
);

export default function ReportsPage() {
  const t = useTranslations("reports");
  const { filters, sales, cashier, ordersReport, cancellation } = useReportsPage();

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
            children: <CashierReportTable cashierReports={cashier.cashierReports} loading={cashier.loading} />,
          },
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
