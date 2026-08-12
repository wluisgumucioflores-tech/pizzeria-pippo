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
  category: string;
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
}

export interface Branch {
  id: string;
  name: string;
}

export type OrderType = "dine_in" | "takeaway" | "delivery" | "pedidos_ya";

export type PosTab = "sale" | "promos" | "orders" | "summary";

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
}
