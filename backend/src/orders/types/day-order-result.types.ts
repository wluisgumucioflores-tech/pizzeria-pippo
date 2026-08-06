export interface DayOrderResult {
  id: string;
  daily_number: number;
  created_at: string;
  total: number;
  kitchen_status: string;
  payment_method: string | null;
  payment_provider: string | null;
  order_type: string;
  cancelled_at: string | null;
  notes: string | null;
  order_items: {
    qty: number;
    product_variants: { name: string; products: { name: string } | null } | null;
  }[];
  payments: { method: string; amount: number }[];
}
