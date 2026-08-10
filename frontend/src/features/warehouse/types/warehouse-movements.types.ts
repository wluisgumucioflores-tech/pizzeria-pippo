export interface MovementFilters {
  type?: string;
  ingredientId?: string;
  variantId?: string;
  branchId?: string;
  from?: string;
  to?: string;
}

export interface WMovIngredient { id: string; name: string; unit: string; }
export interface WMovBranch { id: string; name: string; }
export interface WMovProductVariant { id: string; name: string; products: { name: string } | null; }

export interface IngredientMovement {
  id: string;
  ingredient_id: string;
  quantity: number;
  type: string;
  branch_id: string | null;
  notes: string | null;
  created_at: string;
  ingredients: WMovIngredient;
  branches: WMovBranch | null;
}

export interface ProductMovement {
  id: string;
  variant_id: string;
  quantity: number;
  type: string;
  branch_id: string | null;
  notes: string | null;
  created_at: string;
  product_variants: WMovProductVariant | null;
  branches: WMovBranch | null;
}

export interface UnifiedMovement {
  id: string;
  quantity: number;
  type: string;
  branch_id: string | null;
  notes: string | null;
  created_at: string;
  origin: "ingredient" | "product";
  detailName: string;
  unit: string;
  branches: WMovBranch | null;
}

export const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  compra: "green", transferencia: "blue", ajuste: "orange",
};

export function getMovementTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    compra: t("types.compra"),
    transferencia: t("types.transferencia"),
    ajuste: t("types.ajuste"),
  };
}
