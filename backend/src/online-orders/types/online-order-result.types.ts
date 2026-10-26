// Shapes returned by the MANAGEMENT endpoints (admin/cajero). Unlike the
// public ones, these do carry the customer's name and phone — that's the whole
// point: the business needs to know who to call.

export interface OnlineOrderLine {
  variant_id: string;
  product_name: string;
  variant_name: string;
  qty: number;
  unit_price: number;
}

export interface OnlineOrderResult {
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
  /** Ticket number of the sale it became, once confirmed. */
  daily_number: number | null;
  order_id: string | null;
  items: OnlineOrderLine[];
}

export interface ConfirmOnlineOrderResult {
  order_id: string;
  daily_number: number;
}
