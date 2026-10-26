// Shapes of the MANAGEMENT endpoints (admin/cajero). Unlike the public ones
// these do carry the customer's name and phone — that's the point: the
// business needs to know who to call.

export interface OnlineOrderRowItem {
  variant_id: string;
  product_name: string;
  variant_name: string;
  qty: number;
  unit_price: number;
}

export interface OnlineOrderRow {
  id: string;
  reference: string;
  branch_id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  notes: string | null;
  reject_reason: string | null;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  daily_number: number | null;
  order_id: string | null;
  items: OnlineOrderRowItem[];
}

/** Los cuatro estados posibles, iguales al CHECK de online_orders en la 076. */
export const ONLINE_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "expired",
] as const;

export type OnlineOrderStatusFilter = (typeof ONLINE_ORDER_STATUSES)[number];

export interface OnlineOrdersHistoryFilters {
  /** Vacío = todas las sucursales del negocio. */
  branchId?: string;
  status?: OnlineOrderStatusFilter;
  from?: string;
  to?: string;
}

export interface OnlineOrdersHistory {
  items: OnlineOrderRow[];
  /** Filas que matchean el filtro, sin paginar — maneja el paginador. */
  count: number;
  /** Suma de `total` sobre TODO el filtro, no solo la página visible. */
  total_amount: number;
}

export interface ConfirmOnlineOrderResult {
  order_id: string;
  daily_number: number;
}

/** Payload of the `online-order:created` socket event. */
export interface OnlineOrderCreatedEvent {
  id: string;
  reference: string;
  customer_name: string;
  total: number;
  created_at: string;
  expires_at: string;
}

/** Payload of `online-order:resolved` — someone confirmed/rejected it, or it expired. */
export interface OnlineOrderResolvedEvent {
  id: string;
  status: string;
}
