// Payload del evento de socket order:created — superset de DayOrderResult
// (POS/mesero) y KitchenOrderResult (cocina), los tres consumidores del
// mismo evento. Se arma en memoria en OrdersService.create() a partir de
// datos ya resueltos (variantes, promos, precios) — sin queries extra —
// para que el frontend pueda insertar el pedido nuevo sin recargar la lista.
export interface OrderCreatedEventResult {
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
  last_ready_at: string | null;
  order_items: {
    id: string;
    qty: number;
    qty_physical: number;
    created_at: string;
    unit_price: number;
    discount_applied: number;
    promo_label: string | null;
    product_variants: {
      name: string;
      products: {
        name: string;
        description: string | null;
        category: string | null;
        category_id: string | null;
      } | null;
    } | null;
    order_item_flavors: {
      variant_id: string;
      proportion: number;
      product_variants: { products: { name: string } | null } | null;
    }[];
    order_item_extras: { name: string; price: number }[];
  }[];
  payments: { method: string; amount: number }[];
}
