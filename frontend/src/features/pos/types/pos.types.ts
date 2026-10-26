import type { DiscountedItem } from "@/lib/promotions";

export interface Variant {
  id: string;
  name: string;
  base_price: number;
  is_active: boolean;
  stock_quantity?: number | null;
  recipes?: unknown[];
  branch_prices: { branch_id: string; price: number }[];
}

export interface Product {
  id: string;
  name: string;
  category: string | null;
  category_id: string | null;
  description: string;
  image_url: string;
  is_active: boolean;
  product_variants: Variant[];
}

export interface Identity {
  id: string;
  name: string;
  role: string;
  branch_id: string | null;
  /** Business's offlineSales module — gates the local sales queue entirely. */
  offline_sales: boolean;
  /** Business's onlineOrders module — gates the QR requests tab entirely. */
  online_orders: boolean;
}

export interface Branch {
  id: string;
  name: string;
}

export type OrderType = "dine_in" | "takeaway" | "delivery" | "pedidos_ya" | "online";

// "online" solo aparece si el negocio tiene el módulo onlineOrders
// (docs/features/pedidos-online-qr/) — ver PosHeader.
export type PosTab = "sale" | "promos" | "orders" | "summary" | "online";

export type PaymentMethod = "efectivo" | "qr" | "online" | "mixto" | null;

// One leg of a split (mixto) payment — always efectivo or qr, never online.
export interface SplitPayment {
  method: "efectivo" | "qr";
  amount: number;
}

export interface DayOrder {
  id: string;
  daily_number: number;
  created_at: string;
  total: number;
  kitchen_status: string;
  payment_method: PaymentMethod;
  payment_provider: string | null;
  order_type: OrderType;
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
    product_variants: { name: string; products: { name: string } | null } | null;
    order_item_extras: { name: string; price: number }[];
  }[];
  payments: SplitPayment[];
}

export interface TicketData {
  orderId: string;
  dailyNumber: number;
  items: DiscountedItem[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentProvider: string | null;
  payments?: SplitPayment[] | null;
  orderType: OrderType;
  tableNumber?: string | null;
  waiterName?: string | null;
  notes?: string | null;
  // Cash handed over and change returned. Only set when the cashier used the
  // change calculator during this sale — they are not persisted with the
  // order, so a ticket reprinted later from "Pedidos del día" has neither.
  cashReceived?: number | null;
  changeGiven?: number | null;
}
