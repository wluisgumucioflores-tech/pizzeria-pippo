import type { FlavorItem } from "@/lib/promotions";

export type MeseroOrderType = "dine_in" | "takeaway";

export interface MeseroExtra {
  name: string;
  price: number;
}

export interface MeseroCartItem {
  variant_id: string;
  qty: number;
  unit_price: number;
  product_name: string;
  variant_name: string;
  category: string;
  extras: MeseroExtra[];
  flavors?: FlavorItem[];
}
