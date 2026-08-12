export interface FlavorRow {
  variant_id: string;
  proportion: number;
  product_variants: { products: { name: string } | null } | null;
}

export interface OrderItem {
  id: string;
  qty_physical: number;
  qty: number;
  product_variants: {
    name: string;
    products: {
      name: string;
      description: string;
    } | null;
  } | null;
  order_item_flavors: FlavorRow[];
}

export interface KitchenOrder {
  id: string;
  daily_number: number;
  created_at: string;
  kitchen_status: string;
  order_type: "dine_in" | "takeaway" | "delivery" | "pedidos_ya";
  table_number: string | null;
  waiter_name: string | null;
  order_items: OrderItem[];
}
