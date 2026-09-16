export interface TopProductResult {
  variant_id: string;
  product_name: string;
  variant_name: string;
  category: string | null;
  category_id: string | null;
  qty: number;
  revenue: number;
}

export interface CashierReportResult {
  cashier_id: string;
  cashier_name: string;
  orders: number;
  total: number;
  items: TopProductResult[];
}

// Fase 11 (docs/features/jefe-produccion/roadmap-fases.md) — the "arqueo":
// made-in-house stock left at ONE specific branch, as of the filtered
// period. Only makes sense with a specific branch selected (not "all") and
// with the business-wide "Elaboración propia por unidad transferida" switch
// on — without it, branch_product_stock never fills in for made products
// (see order-stock.ts).
export interface BranchElaboratedStockRow {
  variant_id: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  // Sold in the filtered period/branch (not a historical running total).
  sold_quantity: number;
}

export interface CashierReportListResult {
  cashiers: CashierReportResult[];
  branch_stock: BranchElaboratedStockRow[];
}

export interface ProductionIngredientSummary {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  total_quantity: number;
}

export interface ProductionOutputSummary {
  variant_id: string;
  product_name: string;
  variant_name: string;
  total_quantity: number;
}

// No branch filter on purpose: production logs are business-level (see
// docs/features/jefe-produccion/feature.md), they have no branch_id.
export interface ProductionReportResult {
  ingredients: ProductionIngredientSummary[];
  outputs: ProductionOutputSummary[];
}
