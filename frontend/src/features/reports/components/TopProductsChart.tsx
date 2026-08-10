"use client";

import { Card } from "antd";
import { useTranslations } from "next-intl";
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from "recharts";
import type { TopProduct } from "../types/reports.types";

const CATEGORY_COLORS: Record<string, string> = {
  pizza: "#f97316",
  bebida: "#3b82f6",
  otro: "#22c55e",
};

interface Props {
  topProducts: TopProduct[];
}

export function TopProductsChart({ topProducts }: Props) {
  const t = useTranslations("reports");
  const categoryData = topProducts.reduce((acc, p) => {
    const existing = acc.find((a) => a.name === p.category);
    if (existing) { existing.value += p.revenue; }
    else { acc.push({ name: p.category, value: p.revenue }); }
    return acc;
  }, [] as { name: string; value: number }[]);

  return (
    <Card title={t("salesByCategory")} size="small">
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
              {categoryData.map((entry) => (
                <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#94a3b8"} />
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
