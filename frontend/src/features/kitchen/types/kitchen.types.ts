export interface FlavorRow {
  variant_id: string;
  proportion: number;
  product_variants: { products: { name: string } | null } | null;
}

export interface ExtraRow {
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  qty_physical: number;
  qty: number;
  created_at: string;
  product_variants: {
    name: string;
    products: {
      name: string;
      description: string;
      category: string;
    } | null;
  } | null;
  order_item_flavors: FlavorRow[];
  order_item_extras: ExtraRow[];
}

export type KitchenDisplayMode = "full" | "pizzas_only";

export interface KitchenOrder {
  id: string;
  daily_number: number;
  created_at: string;
  kitchen_status: string;
  order_type: "dine_in" | "takeaway" | "delivery" | "pedidos_ya";
  table_number: string | null;
  waiter_name: string | null;
  last_ready_at: string | null;
  order_items: OrderItem[];
}

export interface KitchenStageSettings {
  kitchen_stage_warning_minutes: number;
  kitchen_late_threshold_minutes: number;
  kitchen_color_fresh: string;
  kitchen_color_warning: string;
  kitchen_color_late: string;
  kitchen_display_mode: KitchenDisplayMode;
}
