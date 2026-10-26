// Shapes returned by the public order endpoints.

export interface CreatePublicOrderResult {
  /** The handle the customer polls their own order with. Not the row id. */
  public_token: string;
  /** Short human reference shown on screen and inside the WhatsApp text. */
  reference: string;
  /** Server-computed. The client's own total is never echoed back. */
  total: number;
  expires_at: string;
  /** Empty when the business has no WhatsApp number configured. */
  whatsapp_url: string;
}

export interface PublicOrderStatusLine {
  product_name: string;
  variant_name: string;
  qty: number;
  unit_price: number;
}

export interface PublicOrderStatusResult {
  reference: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  total: number;
  created_at: string;
  expires_at: string;
  items: PublicOrderStatusLine[];
  /** Ticket number of the resulting sale, only once confirmed. */
  daily_number: number | null;
  reject_reason: string | null;
}
