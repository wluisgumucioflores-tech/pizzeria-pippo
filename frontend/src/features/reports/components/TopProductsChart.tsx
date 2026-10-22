"use client";

import { Card } from "antd";
import { useTranslations } from "next-intl";
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from "recharts";
import { useCategoryOptions } from "@/features/categories/hooks/useCategoryOptions";
import { ChartDownloadButton } from "@/components/ChartDownloadButton";
import { useDownloadChartImage } from "@/hooks/useDownloadChartImage";
import type { TopProduct } from "../types/reports.types";

const PALETTE = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];

interface Props {
  topProducts: TopProduct[];
}

export function TopProductsChart({ topProducts }: Props) {
  const t = useTranslations("reports");
  const { ref, download, downloading } = useDownloadChartImage("ventas-por-categoria");
  const { options: categoryOptions } = useCategoryOptions();
  const categoryLabel = (categoryId: string | null) =>
    categoryOptions.find((c) => c.value === categoryId)?.label ?? "—";
  const categoryData = topProducts.reduce((acc, p) => {
    const name = categoryLabel(p.category_id);
    const existing = acc.find((a) => a.name === name);
    if (existing) { existing.value += p.revenue; }
    else { acc.push({ name, value: p.revenue }); }
    return acc;
  }, [] as { name: string; value: number }[]);

  return (
    <Card
      ref={ref}
      title={t("salesByCategory")}
      size="small"
      extra={categoryData.length > 0 ? <ChartDownloadButton onClick={download} loading={downloading} /> : undefined}
    >
      {categoryData.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
              isAnimationActive={false}
            >
              {categoryData.map((entry, i) => (
                <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `Bs ${Number(v).toFixed(2)}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 192, color: "#9ca3af" }}>
          {t("summary.noDataPeriod")}
        </div>
      )}
    </Card>
  );
}
