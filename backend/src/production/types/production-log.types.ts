export interface IngredientUsageLogRow {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity: number;
  notes: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

export interface OutputLogRow {
  id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  notes: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

export interface ProductionLogListResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
