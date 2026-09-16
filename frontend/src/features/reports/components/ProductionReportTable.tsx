"use client";

import { useState } from "react";
import { Segmented, Table, Empty } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { ProductionIngredientSummary, ProductionReport } from "../types/reports.types";

type ReportsTranslator = ReturnType<typeof useTranslations>;
type Tab = "ingredients" | "outputs";

function buildIngredientColumns(t: ReportsTranslator) {
  return [
    { title: t("production.columns.ingredient"), dataIndex: "ingredient_name", key: "ingredient_name" },
    {
      title: t("production.columns.quantity"),
      key: "quantity",
      render: (_: unknown, r: ProductionIngredientSummary) => <>{r.total_quantity} {r.unit}</>,
    },
  ];
}

function buildOutputColumns(t: ReportsTranslator) {
  return [
    { title: t("production.columns.product"), dataIndex: "product_name", key: "product_name" },
    { title: t("production.columns.variant"), dataIndex: "variant_name", key: "variant_name" },
    { title: t("production.columns.quantity"), dataIndex: "total_quantity", key: "total_quantity" },
  ];
}

function BarRow({ label, value, pct, isMobile }: { label: string; value: string; pct: number; isMobile: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 4 : 12, marginBottom: 14 }}>
      {isMobile ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "#374151" }}>{label}</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
      ) : (
        <div style={{ width: 160, fontSize: 13, color: "#374151", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </div>
      )}
      <div style={{ flex: 1, height: isMobile ? 10 : 20, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#f97316", borderRadius: 4 }} />
      </div>
      {!isMobile && <div style={{ width: 72, textAlign: "right", fontSize: 13, fontWeight: 600 }}>{value}</div>}
    </div>
  );
}

interface Props {
  productionReport: ProductionReport;
  loading: boolean;
}

export function ProductionReportTable({ productionReport, loading }: Props) {
  const t = useTranslations("reports");
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("ingredients");

  const ingredients = [...productionReport.ingredients].sort((a, b) => b.total_quantity - a.total_quantity);
  const outputs = [...productionReport.outputs].sort((a, b) => b.total_quantity - a.total_quantity);
  const maxIngredient = Math.max(1, ...ingredients.map((i) => i.total_quantity));
  const maxOutput = Math.max(1, ...outputs.map((o) => o.total_quantity));

  const isIngredients = tab === "ingredients";
  const rows = isIngredients ? ingredients : outputs;
  const isEmpty = !loading && rows.length === 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { label: t("production.ingredientsTitle"), value: "ingredients" },
            { label: t("production.outputsTitle"), value: "outputs" },
          ]}
        />
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af" }}>
          <InfoCircleOutlined />
          {t("production.branchNote")}
        </span>
      </div>

      {loading ? (
        isIngredients ? (
          <Table dataSource={[]} columns={buildIngredientColumns(t)} loading pagination={false} size="small" />
        ) : (
          <Table dataSource={[]} columns={buildOutputColumns(t)} loading pagination={false} size="small" />
        )
      ) : isEmpty ? (
        <Empty description={t("summary.noDataPeriod")} style={{ padding: "40px 0" }} />
      ) : (
        <>
          <div style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: isMobile ? "16px" : "20px 24px", marginBottom: 16 }}>
            {isIngredients
              ? ingredients.map((row) => (
                  <BarRow
                    key={row.ingredient_id}
                    label={row.ingredient_name}
                    value={`${row.total_quantity} ${row.unit}`}
                    pct={(row.total_quantity / maxIngredient) * 100}
                    isMobile={isMobile}
                  />
                ))
              : outputs.map((row) => (
                  <BarRow
                    key={row.variant_id}
                    label={`${row.product_name} — ${row.variant_name}`}
                    value={`${row.total_quantity}`}
                    pct={(row.total_quantity / maxOutput) * 100}
                    isMobile={isMobile}
                  />
                ))}
          </div>

          {isIngredients ? (
            <Table dataSource={ingredients} columns={buildIngredientColumns(t)} rowKey="ingredient_id" pagination={false} size="small" />
          ) : (
            <Table dataSource={outputs} columns={buildOutputColumns(t)} rowKey="variant_id" pagination={false} size="small" />
          )}
        </>
      )}
    </div>
  );
}
