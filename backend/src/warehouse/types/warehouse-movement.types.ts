export interface WarehouseMovementRow {
  id: string;
  ingredient_id: string;
  quantity: number;
  type: string;
  branch_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  ingredients: { name: string; unit: string };
  branches: { name: string } | null;
}
