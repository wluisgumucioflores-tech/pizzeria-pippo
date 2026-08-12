// Ported 1:1 from frontend/src/lib/order-stock.ts (pure logic, no I/O) so the
// server-side stock deduction calculation stays in exact parity.
// create_order_atomic() applies these deductions transactionally.

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'pedidos_ya';

export interface RecipeRow {
  ingredient_id: string;
  quantity: number;
  apply_condition: string;
  is_shared_use: boolean;
}

export interface StockItem {
  variant_id: string;
  qty_physical: number;
  product_type: string;
  flavors?: { variant_id: string; proportion: number }[] | null;
}

export interface StockDeductions {
  ingredient_deductions: { ingredient_id: string; quantity: number }[];
  resale_deductions: { variant_id: string; quantity: number }[];
  // Flavor variants in a mixed item with zero recipes configured at all —
  // doesn't block the sale, but signals an incomplete product setup worth
  // reviewing (this is exactly how bug 05 slipped through).
  incomplete_recipe_variant_ids: string[];
}

function recipeApplies(recipe: RecipeRow, orderType: OrderType): boolean {
  const condition = recipe.apply_condition ?? 'always';
  return condition === 'always' || condition === orderType;
}

export function computeStockDeductions(
  items: StockItem[],
  recipesByVariant: Record<string, RecipeRow[]>,
  orderType: OrderType,
): StockDeductions {
  const ingredients: Record<string, number> = {};
  const resale: Record<string, number> = {};
  const incompleteRecipeVariantIds = new Set<string>();

  for (const item of items) {
    if (item.product_type === 'resale') {
      resale[item.variant_id] = (resale[item.variant_id] ?? 0) + item.qty_physical;
      continue;
    }

    const flavors = item.flavors ?? [];
    if (flavors.length > 0) {
      // Shared-use ingredients (e.g. the box) are needed once per physical
      // item regardless of how many flavors it's split into — take the first
      // matching recipe found across the mixed flavors and apply it whole,
      // instead of prorating it like per-flavor ingredients (dough, cheese).
      const sharedQuantityByIngredient: Record<string, number> = {};

      for (const flavor of flavors) {
        const flavorRecipes = recipesByVariant[flavor.variant_id] ?? [];
        if (flavorRecipes.length === 0) incompleteRecipeVariantIds.add(flavor.variant_id);

        for (const recipe of flavorRecipes) {
          if (!recipeApplies(recipe, orderType)) continue;
          if (recipe.is_shared_use) {
            sharedQuantityByIngredient[recipe.ingredient_id] ??= recipe.quantity;
          } else {
            ingredients[recipe.ingredient_id] =
              (ingredients[recipe.ingredient_id] ?? 0) + recipe.quantity * item.qty_physical * flavor.proportion;
          }
        }
      }

      for (const [ingredientId, quantity] of Object.entries(sharedQuantityByIngredient)) {
        ingredients[ingredientId] = (ingredients[ingredientId] ?? 0) + quantity * item.qty_physical;
      }
    } else {
      for (const recipe of recipesByVariant[item.variant_id] ?? []) {
        if (!recipeApplies(recipe, orderType)) continue;
        ingredients[recipe.ingredient_id] = (ingredients[recipe.ingredient_id] ?? 0) + recipe.quantity * item.qty_physical;
      }
    }
  }

  return {
    ingredient_deductions: Object.entries(ingredients).map(([ingredient_id, quantity]) => ({ ingredient_id, quantity })),
    resale_deductions: Object.entries(resale).map(([variant_id, quantity]) => ({ variant_id, quantity })),
    incomplete_recipe_variant_ids: Array.from(incompleteRecipeVariantIds),
  };
}
