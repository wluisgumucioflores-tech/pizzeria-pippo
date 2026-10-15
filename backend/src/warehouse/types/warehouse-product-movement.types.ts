export interface WarehouseProductMovementRow {
  id: string;
  variant_id: string;
  branch_id: string | null;
  quantity: number;
  type: string;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  product_variants: {
    id: string;
    name: string;
    products: { id: string; name: string } | null;
  } | null;
  branches: { id: string; name: string } | null;
}
