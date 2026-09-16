export interface VariantOption {
  id: string;
  name: string;
  product_name: string;
}

export interface IngredientUsageLog {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity: number;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface OutputLog {
  id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ProductionLogListParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export interface ProductionLogListResult<T> {
  data: T[];
  total: number;
}

export interface Branch {
  id: string;
  name: string;
}

export interface WarehouseStockOption {
  variant_id: string;
  quantity: number;
  product_variants: { name: string; products: { name: string } | null } | null;
}
