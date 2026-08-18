export interface OrderReportItemResult {
  qty: number;
  unit_price: number;
  discount_applied: number;
  promo_label: string | null;
  price_edited: boolean;
  product_variants: { name: string; products: { name: string; category: string | null; category_id: string | null } | null } | null;
}

export interface OrderReportPaymentResult {
  method: string;
  amount: number;
}

export interface OrderReportResult {
  id: string;
  daily_number: number;
  total: number;
  created_at: string;
  branch_id: string;
  cashier_name: string;
  payment_method: string | null;
  payment_provider: string | null;
  order_type: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  branches: { name: string } | null;
  order_items: OrderReportItemResult[];
  payments: OrderReportPaymentResult[];
}
