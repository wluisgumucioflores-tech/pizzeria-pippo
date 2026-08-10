"use client";

import { Card } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { DailyData } from "../types/reports.types";

interface Props {
  dailyData: DailyData[];
}

export function DailySalesChart({ dailyData }: Props) {
  const t = useTranslations("reports");
  return (
    <Card title={t("dailySales")} size="small">
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
              formatter={(v) => [`Bs ${Number(v).toFixed(2)}`, t("totalSales")]}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 192, color: "#9ca3af" }}>
          {t("summary.noDataPeriod")}
        </div>
      )}
    </Card>
  );
}
