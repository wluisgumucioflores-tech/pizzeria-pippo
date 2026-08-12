/**
 * Promotion engine — used by the POS to calculate discounts automatically.
 * No UI dependencies, pure logic.
 */
import { nowInBolivia } from "@/lib/timezone";

export interface FlavorItem {
  variant_id: string;
  product_name: string;
  proportion: number; // fraction of the pizza (e.g. 0.5, 0.25, 0.33...)
}

export interface ExtraItem {
  name: string;
  price: number;
}

export interface CartItem {
  variant_id: string;
  qty: number;
  unit_price: number;
  product_name: string;
  variant_name: string;
  category: string;
  flavors?: FlavorItem[]; // only present for mixed pizzas (mitad/mitad)
  promo_id?: string; // set when added via the POS "Promociones" tab — ties this line to that specific promotion
  extras?: ExtraItem[]; // mesero only, never combined with flavors/promo_id — survives passthrough/split since both do `{...item}`
  price_edited?: boolean; // cajero/admin manual override at sale time, never combined with promo_id/flavors — same passthrough pattern
}

export interface PromotionRule {
  id: string;
  variant_id: string | null;
  buy_qty: number | null;
  get_qty: number | null;
  discount_percent: number | null;
  combo_price: number | null;
  category: string | null;      // "pizza" | "bebida" | "otro" | null — only for flexible combos
  variant_size: string | null;  // "Personal" | "Mediana" | "Familiar" | null — only for flexible combos
}

export interface Promotion {
  id: string;
  name: string;
  type: "BUY_X_GET_Y" | "PERCENTAGE" | "COMBO";
  days_of_week: number[];
  start_date: string;
  end_date: string;
  branch_id: string | null;
  active: boolean;
  promotion_rules: PromotionRule[];
}

export interface DiscountedItem extends CartItem {
  qty_physical: number;   // units physically prepared (affects stock)
  discount_applied: number;
  final_price: number;
  promo_label: string | null;
}

/**
 * Returns promotions that are active for a given branch and date.
 */
export function getActivePromotions(
  promotions: Promotion[],
  branchId: string,
  date: Date = nowInBolivia()
): Promotion[] {
  const dayOfWeek = date.getDay();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;

  return promotions.filter((p) => {
    if (!p.active) return false;
    if (p.branch_id && p.branch_id !== branchId) return false;
    if (dateStr < p.start_date || dateStr > p.end_date) return false;
    if (p.days_of_week.length > 0 && !p.days_of_week.includes(dayOfWeek)) return false;
    return true;
  });
}

/**
 * Applies active promotions to cart items.
 * Each item gets at most one promo (best discount wins, no stacking).
 */
export function applyPromotions(
  cartItems: CartItem[],
  activePromotions: Promotion[]
): DiscountedItem[] {
  let result: DiscountedItem[] = cartItems.map((item) => ({
    ...item,
    qty_physical: item.qty,
    discount_applied: 0,
    final_price: item.unit_price,
    promo_label: null,
  }));

  for (const promo of activePromotions) {
    if (promo.type === "BUY_X_GET_Y") {
      applyBuyXGetY(result, promo);
    } else if (promo.type === "PERCENTAGE") {
      applyPercentage(result, promo);
    } else if (promo.type === "COMBO") {
      result = applyCombo(result, promo);
    }
  }

  return result;
}

function applyBuyXGetY(items: DiscountedItem[], promo: Promotion) {
  for (const rule of promo.promotion_rules) {
    if (!rule.variant_id || !rule.buy_qty || !rule.get_qty) continue;

    const item = items.find((i) => i.variant_id === rule.variant_id);
    if (!item) continue;

    // qty = units the customer pays for (what the cashier enters)
    // For every buy_qty paid, get_qty come out of the kitchen for free
    // qty_physical = qty + freeUnits (all units that leave the kitchen)
    const paid = item.qty;
    const sets = Math.floor(paid / rule.buy_qty);
    const freeUnits = sets * rule.get_qty;

    if (freeUnits <= 0) continue;

    const discount = freeUnits * item.unit_price;
    if (discount > item.discount_applied) {
      item.qty_physical = paid + freeUnits;   // total units leaving the kitchen
      item.discount_applied = discount;
      item.final_price = item.unit_price;
      item.promo_label = `${rule.buy_qty + rule.get_qty}x${rule.buy_qty} — ${promo.name}`;
    }
  }
}

function applyPercentage(items: DiscountedItem[], promo: Promotion) {
  for (const rule of promo.promotion_rules) {
    if (!rule.discount_percent) continue;

    // Only items explicitly added via the POS "Promociones" tab for this promo are eligible —
    // adding the same product from the regular catalog never triggers the discount.
    const targets = items.filter((i) => {
      if (i.promo_id !== promo.id) return false;
      return rule.variant_id ? i.variant_id === rule.variant_id : true;
    });

    for (const item of targets) {
      const discount = (item.unit_price * item.qty * rule.discount_percent) / 100;
      if (discount > item.discount_applied) {
        item.discount_applied = discount;
        item.final_price = item.unit_price * (1 - rule.discount_percent / 100);
        item.promo_label = `${rule.discount_percent}% OFF — ${promo.name}`;
      }
    }
  }
}

function ruleMatchesItem(rule: PromotionRule, item: DiscountedItem): boolean {
  if (rule.variant_id) return item.variant_id === rule.variant_id;
  const categoryMatch = !rule.category || item.category === rule.category;
  const sizeMatch = !rule.variant_size || item.variant_name === rule.variant_size;
  return categoryMatch && sizeMatch;
}

/**
 * Applies a COMBO promotion.
 * Returns a new items array. Items that are partially consumed by the combo
 * (qty > 1 but only 1 unit goes to the combo) are split into two separate
 * DiscountedItem entries so only the combo unit gets the label and discount.
 */
function applyCombo(items: DiscountedItem[], promo: Promotion): DiscountedItem[] {
  const comboPrice = promo.promotion_rules[0]?.combo_price;
  if (comboPrice == null) {
    console.warn(`[Combo] "${promo.name}" no tiene combo_price definido en regla 0`);
    return items;
  }

  // Step 1 — match each rule to one item, tracking units claimed per item index
  const claimedPerIndex = new Map<number, number>();
  const matchedIndices: number[] = []; // one entry per rule, may repeat if same item matches multiple rules

  for (const rule of promo.promotion_rules) {
    let found = false;
    for (let i = 0; i < items.length; i++) {
      if (!ruleMatchesItem(rule, items[i])) continue;
      // Skip items already fully consumed by a previous combo
      if (items[i].promo_label) continue;
      const claimed = claimedPerIndex.get(i) ?? 0;
      if (items[i].qty - claimed < 1) continue;
      claimedPerIndex.set(i, claimed + 1);
      matchedIndices.push(i);
      found = true;
      break;
    }
    if (!found) return items; // incomplete combo
  }

  // Step 2 — calculate total discount
  const originalTotal = matchedIndices.reduce((sum, idx) => sum + items[idx].unit_price, 0);
  const totalDiscount = originalTotal - comboPrice;
  if (totalDiscount <= 0) return items;

  // Step 3 — build output: split items that are partially claimed, label combo slices
  // Process indices in ascending order so splits don't shift unprocessed positions
  const sortedIndices = Array.from(claimedPerIndex.keys()).sort((a, b) => a - b);
  const result: DiscountedItem[] = [];
  const comboSliceByOrigIndex = new Map<number, DiscountedItem>(); // for discount application

  for (let i = 0; i < items.length; i++) {
    const item = { ...items[i] };
    if (!claimedPerIndex.has(i)) {
      result.push(item);
      continue;
    }
    const claimed = claimedPerIndex.get(i)!;
    if (item.qty > claimed) {
      // Split: combo slice first, then remainder
      const comboSlice: DiscountedItem = { ...item, qty: claimed, qty_physical: claimed };
      const remainder: DiscountedItem = { ...item, qty: item.qty - claimed, qty_physical: item.qty - claimed };
      result.push(comboSlice, remainder);
      comboSliceByOrigIndex.set(i, comboSlice);
    } else {
      // All units of this item go to the combo
      result.push(item);
      comboSliceByOrigIndex.set(i, item);
    }
  }

  void sortedIndices; // used implicitly via claimedPerIndex iteration order above

  // Step 4 — apply discount proportionally to each combo slice (once per unique orig index)
  const processed = new Set<number>();
  for (const origIndex of matchedIndices) {
    if (processed.has(origIndex)) continue;
    processed.add(origIndex);

    const comboSlice = comboSliceByOrigIndex.get(origIndex);
    if (!comboSlice) continue;

    const claimed = claimedPerIndex.get(origIndex) ?? 1;
    const share = (comboSlice.unit_price * claimed) / originalTotal;
    const discount = totalDiscount * share;
    comboSlice.discount_applied = discount;
    comboSlice.final_price = comboSlice.unit_price - discount;
    comboSlice.promo_label = `Combo — ${promo.name}`;
  }

  return result;
}

/**
 * Returns total discount amount for the cart.
 */
export function getTotalDiscount(items: DiscountedItem[]): number {
  return items.reduce((sum, i) => sum + i.discount_applied, 0);
}

/**
 * Returns cart total after discounts.
 */
export function getCartTotal(items: DiscountedItem[]): number {
  return items.reduce((sum, i) => sum + i.unit_price * i.qty_physical - i.discount_applied, 0);
}
