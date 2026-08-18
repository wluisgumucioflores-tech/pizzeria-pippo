import type { DiscountedItem } from "@/lib/promotions";

export type DisplayMode = "menu" | "order" | "thanks";

export type OrderType = "dine_in" | "takeaway";

export type DisplayCartItem = DiscountedItem;

export interface DisplayProduct {
  id: string;
  name: string;
  category: string | null;
  category_id: string | null;
  description: string;
  image_url: string;
  product_variants: { id: string; name: string; base_price: number }[];
}
