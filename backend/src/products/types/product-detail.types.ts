export interface ProductDetailRecipe {
  ingredient_id: string;
  quantity: number;
  apply_condition: string;
  ingredients: { name: string; unit: string };
}

export interface ProductDetailBranchPrice {
  branch_id: string;
  variant_id: string;
  price: number;
  branches: { name: string };
}

export interface ProductDetailVariant {
  id: string;
  product_id: string;
  name: string;
  base_price: number;
  created_at: string;
  is_active: boolean;
  branch_prices: ProductDetailBranchPrice[];
  recipes: ProductDetailRecipe[];
}

export interface ProductDetailResult {
  id: string;
  name: string;
  category: string | null;
  category_id: string | null;
  description: string | null;
  image_url: string | null;
  product_type: string;
  created_at: string;
  is_active: boolean;
  product_variants: ProductDetailVariant[];
}
