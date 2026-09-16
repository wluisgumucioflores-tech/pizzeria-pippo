"use client";

import { useEffect, useState } from "react";
import { Card, Space } from "antd";
import { useTranslations } from "next-intl";
import { useCategoryOptions } from "@/features/categories/hooks/useCategoryOptions";
import { BranchStockCard } from "./BranchStockCard";
import { CashierBreakdownCard } from "./CashierBreakdownCard";
import type { CashierReport, BranchElaboratedStock } from "../types/reports.types";

function minutesAgo(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));
}

interface Props {
  cashierReports: CashierReport[];
  branchStock: BranchElaboratedStock[];
  loading: boolean;
  branchLabel?: string;
  lastUpdatedAt: Date | null;
}

export function CashierReportTable({ cashierReports, branchStock, loading, branchLabel, lastUpdatedAt }: Props) {
  const t = useTranslations("reports");
  const { options: categoryOptions } = useCategoryOptions();
  const categoryLabel = (categoryId: string | null) =>
    categoryOptions.find((c) => c.value === categoryId)?.label ?? "—";

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const updatedLabel = lastUpdatedAt
    ? (() => {
        const mins = minutesAgo(lastUpdatedAt, now);
        return mins < 1 ? t("branchStock.updatedJustNow") : t("branchStock.updatedAgo", { count: mins });
      })()
    : null;

  const cashierSubtitle = branchLabel ? `${t("cashier.role")} · ${branchLabel}` : t("cashier.role");

  if (cashierReports.length === 0 && !loading) {
    return (
      <>
        <BranchStockCard branchStock={branchStock} updatedLabel={updatedLabel} />
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "#9ca3af" }}>
            {t("summary.noSalesPeriod")}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <BranchStockCard branchStock={branchStock} updatedLabel={updatedLabel} />

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {cashierReports.map((c) => (
          <CashierBreakdownCard
            key={c.cashier_id}
            cashier={c}
            loading={loading}
            subtitle={cashierSubtitle}
            categoryLabel={categoryLabel}
          />
        ))}
      </Space>
    </>
  );
}
