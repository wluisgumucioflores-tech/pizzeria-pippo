/**
 * Pure stock-deduction calculator for confirmed orders.
 * No I/O — the API route fetches the data, this computes the deductions,
 * and create_order_atomic() applies them transactionally.
 */

export type OrderType = "dine_in" | "takeaway" | "delivery" | "pedidos_ya";

export interface RecipeRow {
  ingredient_id: string;
  quantity: number;
  apply_condition: string; // 'always' | 'takeaway' | 'dine_in'
}

export interface StockItem {
  variant_id: string;
  qty_physical: number;
  product_type: string; // 'made' | 'resale'
  flavors?: { variant_id: string; proportion: number }[] | null;
}

export interface StockDeductions {
  ingredient_deductions: { ingredient_id: string; quantity: number }[];
  resale_deductions: { variant_id: string; quantity: number }[];
}

function recipeApplies(recipe: RecipeRow, orderType: OrderType): boolean {
  const condition = recipe.apply_condition ?? "always";
  return condition === "always" || condition === orderType;
}

export function computeStockDeductions(
  items: StockItem[],
  recipesByVariant: Record<string, RecipeRow[]>,
  orderType: OrderType
): StockDeductions {
  const ingredients: Record<string, number> = {};
  const resale: Record<string, number> = {};

  for (const item of items) {
    if (item.product_type === "resale") {
      resale[item.variant_id] = (resale[item.variant_id] ?? 0) + item.qty_physical;
      continue;
    }

    const flavors = item.flavors ?? [];
    if (flavors.length > 0) {
      // Mixed pizza: each flavor's recipe weighted by its proportion
      for (const flavor of flavors) {
        for (const recipe of recipesByVariant[flavor.variant_id] ?? []) {
          if (!recipeApplies(recipe, orderType)) continue;
          ingredients[recipe.ingredient_id] =
            (ingredients[recipe.ingredient_id] ?? 0) +
            recipe.quantity * item.qty_physical * flavor.proportion;
        }
      }
    } else {
      for (const recipe of recipesByVariant[item.variant_id] ?? []) {
        if (!recipeApplies(recipe, orderType)) continue;
        ingredients[recipe.ingredient_id] =
          (ingredients[recipe.ingredient_id] ?? 0) + recipe.quantity * item.qty_physical;
      }
    }
  }

  return {
    ingredient_deductions: Object.entries(ingredients).map(([ingredient_id, quantity]) => ({
      ingredient_id,
      quantity,
    })),
    resale_deductions: Object.entries(resale).map(([variant_id, quantity]) => ({
      variant_id,
      quantity,
    })),
  };
}
