export interface KitchenOrderResult {
  id: string;
  daily_number: number;
  created_at: string;
  kitchen_status: string;
  order_type: string;
  table_number: string | null;
  waiter_name: string | null;
  last_ready_at: string | null;
  order_items: {
    id: string;
    qty: number;
    qty_physical: number;
    created_at: string;
    product_variants: {
      name: string;
      products: { name: string; description: string | null } | null;
    } | null;
    order_item_flavors: {
      variant_id: string;
      proportion: number;
      product_variants: { products: { name: string } | null } | null;
    }[];
    order_item_extras: { name: string; price: number }[];
  }[];
}
