"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, Space, Badge } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import { UnifiedStockTable } from "./UnifiedStockTable";
import { StockTypeSelector } from "./StockTypeSelector";
import { StockHistoryTable } from "./StockHistoryTable";
import type { Ingredient, ProductVariantOption, UnifiedMovement, UnifiedStockRow, StockType } from "../types/stock.types";

const StockAdjustForm = dynamic(
  () => import("./StockAdjustForm").then((m) => m.StockAdjustForm),
  { ssr: false, loading: () => <div className="p-8 text-gray-400 text-sm">…</div> }
);
const ProductStockAdjustForm = dynamic(
  () => import("./ProductStockAdjustForm").then((m) => m.ProductStockAdjustForm),
  { ssr: false, loading: () => <div className="p-8 text-gray-400 text-sm">…</div> }
);

interface Props {
  isMobile: boolean;
  alertsCount: number;
  unifiedStock: UnifiedStockRow[];
  loadingUnifiedStock: boolean;
  onEditMinQty: (row: UnifiedStockRow) => void;
  ingredients: Ingredient[];
  adjustForm: FormInstance;
  onAdjust: (values: { ingredient_id: string; real_quantity: number; notes?: string }) => void;
  productVariants: ProductVariantOption[];
  productAdjustForm: FormInstance;
  onProductAdjust: (values: { variant_id: string; real_quantity: number; notes?: string }) => void;
  unifiedMovements: UnifiedMovement[];
  totalHistory: number;
  loadingHistory: boolean;
  pageHistory: number;
  onPageHistoryChange: (page: number) => void;
  pageSize: number;
}

export function StockTabs({
  isMobile, alertsCount,
  unifiedStock, loadingUnifiedStock, onEditMinQty,
  ingredients, adjustForm, onAdjust,
  productVariants, productAdjustForm, onProductAdjust,
  unifiedMovements, totalHistory, loadingHistory, pageHistory, onPageHistoryChange, pageSize,
}: Props) {
  const [adjustType, setAdjustType] = useState<StockType>("ingredient");
  const t = useTranslations("stock");

  const tabItems = [
    {
      key: "stock",
      label: isMobile
        ? <Badge count={alertsCount} size="small">📋</Badge>
        : <Space>{t("tabs.currentStock")}{alertsCount > 0 && <Badge count={alertsCount} />}</Space>,
      children: <UnifiedStockTable stock={unifiedStock} loading={loadingUnifiedStock} onEditMinQty={onEditMinQty} />,
    },
    {
      key: "adjust",
      label: isMobile ? "🔧" : t("tabs.manualAdjust"),
      children: (
        <div>
          <StockTypeSelector value={adjustType} onChange={setAdjustType} />
          {adjustType === "ingredient" ? (
            <StockAdjustForm form={adjustForm} ingredients={ingredients} onSubmit={onAdjust} />
          ) : (
            <ProductStockAdjustForm form={productAdjustForm} variants={productVariants} onSubmit={onProductAdjust} />
          )}
        </div>
      ),
    },
    {
      key: "history",
      label: isMobile ? "🕐" : t("tabs.history"),
      children: (
        <StockHistoryTable
          movements={unifiedMovements}
          loading={loadingHistory}
          page={pageHistory}
          total={totalHistory}
          pageSize={pageSize}
          onPageChange={onPageHistoryChange}
        />
      ),
    },
  ];

  return <Tabs items={tabItems} />;
}
