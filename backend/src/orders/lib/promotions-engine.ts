// Ported 1:1 from frontend/src/lib/promotions.ts (pure logic, no I/O) so the
// server-side pricing calculation stays in exact parity with the POS preview.
// Keep both files in sync if the promotion rules ever change.

export interface FlavorItem {
  variant_id: string;
  product_name: string;
  proportion: number;
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
  flavors?: FlavorItem[];
  promo_id?: string;
  // Solo en items sin promo/flavors (ver orders.service.ts) — sobrevive sin
  // tocar la lógica de abajo porque todo passthrough/split hace `{...item}`.
  extras?: ExtraItem[];
  // Fase 3 — precio editado manualmente por cajero/admin al vender (mismo
  // criterio que extras: solo en items sin promo/flavors). Solo es un flag
  // para la etiqueta "Editado" en UI/Reportes, no afecta el cálculo acá.
  price_edited?: boolean;
}

export interface PromotionRule {
  id: string;
  variant_id: string | null;
  buy_qty: number | null;
  get_qty: number | null;
  discount_percent: number | null;
  combo_price: number | null;
  category: string | null;
  variant_size: string | null;
}

export interface Promotion {
  id: string;
  name: string;
  // Plain string, not a literal union — the DB column has no enum constraint,
  // and this lets OrdersService reuse PromotionsService's PromotionResult
  // directly instead of duplicating the query + mapping.
  type: string;
  days_of_week: number[];
  start_date: string;
  end_date: string;
  branch_id: string | null;
  active: boolean;
  promotion_rules: PromotionRule[];
}

export interface DiscountedItem extends CartItem {
  qty_physical: number;
  discount_applied: number;
  final_price: number;
  promo_label: string | null;
}

// Filters promotions active for a given branch and date (YYYY-MM-DD).
// Single source of truth for this filter — also used by PromotionsService
// for GET /promotions?branchId=&date=, so both stay in sync.
export function getActivePromotions<T extends Pick<Promotion, 'active' | 'branch_id' | 'start_date' | 'end_date' | 'days_of_week'>>(
  promotions: T[],
  branchId: string,
  dateParam: string,
): T[] {
  const [year, month, day] = dateParam.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  return promotions.filter((p) => {
    if (!p.active) return false;
    if (p.branch_id && p.branch_id !== branchId) return false;
    if (dateParam < p.start_date || dateParam > p.end_date) return false;
    if (p.days_of_week.length > 0 && !p.days_of_week.includes(dayOfWeek)) return false;
    return true;
  });
}

// Applies active promotions to cart items. Each item gets at most one promo
// (best discount wins, no stacking).
export function applyPromotions(cartItems: CartItem[], activePromotions: Promotion[]): DiscountedItem[] {
  let result: DiscountedItem[] = cartItems.map((item) => ({
    ...item,
    qty_physical: item.qty,
    discount_applied: 0,
    final_price: item.unit_price,
    promo_label: null,
  }));

  for (const promo of activePromotions) {
    if (promo.type === 'BUY_X_GET_Y') {
      applyBuyXGetY(result, promo);
    } else if (promo.type === 'PERCENTAGE') {
      applyPercentage(result, promo);
    } else if (promo.type === 'COMBO') {
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

    const paid = item.qty;
    const sets = Math.floor(paid / rule.buy_qty);
    const freeUnits = sets * rule.get_qty;

    if (freeUnits <= 0) continue;

    const discount = freeUnits * item.unit_price;
    if (discount > item.discount_applied) {
      item.qty_physical = paid + freeUnits;
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

// Applies a COMBO promotion. Returns a new items array — items partially
// consumed by the combo (qty > 1 but only 1 unit goes to the combo) are
// split into two separate DiscountedItem entries so only the combo unit
// gets the label and discount.
function applyCombo(items: DiscountedItem[], promo: Promotion): DiscountedItem[] {
  const comboPrice = promo.promotion_rules[0]?.combo_price;
  if (comboPrice == null) return items;

  const claimedPerIndex = new Map<number, number>();
  const matchedIndices: number[] = [];

  for (const rule of promo.promotion_rules) {
    let found = false;
    for (let i = 0; i < items.length; i++) {
      if (!ruleMatchesItem(rule, items[i])) continue;
      if (items[i].promo_label) continue;
      const claimed = claimedPerIndex.get(i) ?? 0;
      if (items[i].qty - claimed < 1) continue;
      claimedPerIndex.set(i, claimed + 1);
      matchedIndices.push(i);
      found = true;
      break;
    }
    if (!found) return items;
  }

  const originalTotal = matchedIndices.reduce((sum, idx) => sum + items[idx].unit_price, 0);
  const totalDiscount = originalTotal - comboPrice;
  if (totalDiscount <= 0) return items;

  const result: DiscountedItem[] = [];
  const comboSliceByOrigIndex = new Map<number, DiscountedItem>();

  for (let i = 0; i < items.length; i++) {
    const item = { ...items[i] };
    if (!claimedPerIndex.has(i)) {
      result.push(item);
      continue;
    }
    const claimed = claimedPerIndex.get(i)!;
    if (item.qty > claimed) {
      const comboSlice: DiscountedItem = { ...item, qty: claimed, qty_physical: claimed };
      const remainder: DiscountedItem = { ...item, qty: item.qty - claimed, qty_physical: item.qty - claimed };
      result.push(comboSlice, remainder);
      comboSliceByOrigIndex.set(i, comboSlice);
    } else {
      result.push(item);
      comboSliceByOrigIndex.set(i, item);
    }
  }

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

export function getTotalDiscount(items: DiscountedItem[]): number {
  return items.reduce((sum, i) => sum + i.discount_applied, 0);
}

export function getCartTotal(items: DiscountedItem[]): number {
  return items.reduce((sum, i) => sum + i.unit_price * i.qty_physical - i.discount_applied, 0);
}
