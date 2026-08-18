import type { FlavorItem } from "@/lib/promotions";

export interface SlotSelection {
  variantId: string;
  productName: string;
  variantName: string;
  price: number;
  category: string | null;
  flavors?: FlavorItem[];
}

export interface FlavorEntry {
  variantId: string;
  productName: string;
  parts: number;
}
