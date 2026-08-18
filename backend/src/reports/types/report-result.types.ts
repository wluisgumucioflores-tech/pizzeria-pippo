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
