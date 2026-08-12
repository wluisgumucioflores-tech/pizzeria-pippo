export interface DayOrderResult {
  id: string;
  daily_number: number;
  created_at: string;
  total: number;
  kitchen_status: string;
  payment_method: string | null;
  payment_provider: string | null;
  order_type: string;
  table_number: string | null;
  waiter_name: string | null;
  cancelled_at: string | null;
  notes: string | null;
  order_items: {
    qty: number;
    qty_physical: number;
    unit_price: number;
    discount_applied: number;
    promo_label: string | null;
    product_variants: {
      name: string;
      products: { name: string } | null;
    } | null;
    order_item_extras: { name: string; price: number }[];
  }[];
  payments: { method: string; amount: number }[];
}
