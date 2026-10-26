// Pedidos online por QR — ver docs/features/pedidos-online-qr/.
// Estos tipos espejan lo que devuelve el backend público
// (backend/src/online-orders/types/) — deliberadamente angostos: el menú
// público no trae recetas, costos ni product_type.

export interface PublicMenuVariant {
  id: string;
  name: string;
  /** Ya resuelto para la sucursal del QR. */
  price: number;
}

export interface PublicMenuProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  category_name: string | null;
  variants: PublicMenuVariant[];
}

export interface PublicMenu {
  business_name: string;
  branch_id: string;
  branch_name: string;
  /** Si es false, se esconde el botón de WhatsApp. */
  whatsapp_configured: boolean;
  products: PublicMenuProduct[];
}

/** Una línea del carrito. El precio se guarda solo para mostrarlo: el total real lo calcula el servidor. */
export interface CartLine {
  variant_id: string;
  product_name: string;
  variant_name: string;
  price: number;
  qty: number;
}

export interface CreateOnlineOrderInput {
  branch_id: string;
  customer_name: string;
  customer_phone: string;
  notes?: string;
  items: { variant_id: string; qty: number }[];
}

export interface CreateOnlineOrderResult {
  public_token: string;
  reference: string;
  total: number;
  expires_at: string;
  /** Vacío si el negocio no configuró número. */
  whatsapp_url: string;
}

export type OnlineOrderStatus = "pending" | "confirmed" | "rejected" | "expired";

export interface OnlineOrderStatusLine {
  product_name: string;
  variant_name: string;
  qty: number;
  unit_price: number;
}

export interface OnlineOrderStatusResult {
  reference: string;
  status: OnlineOrderStatus;
  total: number;
  created_at: string;
  expires_at: string;
  items: OnlineOrderStatusLine[];
  /** Número de pedido de la venta, solo una vez confirmado. */
  daily_number: number | null;
  reject_reason: string | null;
}

/**
 * Una entrada del historial del cliente, guardada en su localStorage.
 * El token es la única credencial — no hay cuenta de cliente en el sistema.
 */
export interface StoredOrder {
  token: string;
  /** Vacío en una entrada migrada de la versión anterior, que solo guardaba el token. */
  reference: string;
  total: number;
  created_at: string;
}

/** Las tres pestañas de la barra inferior del cliente. */
export type PublicTab = "menu" | "cart" | "orders";

/** Productos agrupados por categoría, como los renderiza el menú. */
export interface MenuSection {
  category_id: string;
  category_name: string;
  products: PublicMenuProduct[];
}
