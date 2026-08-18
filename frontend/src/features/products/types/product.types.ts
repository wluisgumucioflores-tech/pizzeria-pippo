import type { Product, ProductType, ProductCategory, RecipeItem, RecipeApplyCondition } from "@pippo/shared";

export type { Product, ProductType, ProductCategory, RecipeItem };
export type ApplyCondition = RecipeApplyCondition;

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

export interface Branch {
  id: string;
  name: string;
}

export interface VariantTypeOption {
  value: string;
  label: string;
}

export interface BranchPrice {
  branch_id: string;
  price: number;
}

export interface Variant {
  name: string;
  base_price: number;
  branch_prices: BranchPrice[];
  recipes: RecipeItem[];
  is_active?: boolean;
}

export interface Step1Data {
  name: string;
  category_id: string | null;
  description: string;
  product_type: ProductType;
}

export interface ProductDetailRecipeItem {
  ingredient_id: string;
  quantity: number;
  apply_condition?: string;
  ingredients: { name: string; unit: string };
}

export interface ProductDetailBranchPrice {
  branch_id: string;
  price: number;
  branches?: { name: string };
}

export interface ProductDetailVariant {
  id: string;
  name: string;
  base_price: number;
  is_active: boolean;
  branch_prices: ProductDetailBranchPrice[];
  recipes: ProductDetailRecipeItem[];
}

export interface BranchPriceRow {
  id: string;
  branch_id: string;
  price: number;
  branches: { id: string; name: string } | null;
}

export interface VariantWithPrices {
  id: string;
  name: string;
  base_price: number;
  branch_prices: BranchPriceRow[];
}

export interface ProductDetail {
  id: string;
  name: string;
  category: string | null;
  description: string;
  image_url: string;
  is_active: boolean;
  product_variants: ProductDetailVariant[];
}
