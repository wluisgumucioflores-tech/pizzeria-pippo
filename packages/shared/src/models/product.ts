export type ProductCategory = "pizza" | "bebida" | "otro";
export type ProductType = "made" | "resale";
export type RecipeApplyCondition = "always" | "takeaway" | "dine_in";

export interface RecipeItem {
  ingredient_id: string;
  quantity: number;
  apply_condition: RecipeApplyCondition;
  // Denormalized display data, present only on read responses that embed it
  // (e.g. GET /products/:id/variants) — never sent by the client on write.
  ingredients?: { name: string; unit: string };
}

export interface BranchPrice {
  branch_id: string;
  variant_id: string;
  price: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  base_price: number;
  created_at: string;
  is_active: boolean;
  branch_prices?: BranchPrice[];
  recipes?: RecipeItem[];
}

export interface Product {
  id: string;
  name: string;
  // Legado: espejo best-effort ('pizza' o null), ya no es la fuente de
  // verdad — usar category_id. Se mantiene para lo poco que todavía lo lee.
  category: ProductCategory | null;
  category_id: string | null;
  description: string | null;
  image_url: string | null;
  product_type: ProductType;
  created_at: string;
  is_active: boolean;
  product_variants?: ProductVariant[];
}
