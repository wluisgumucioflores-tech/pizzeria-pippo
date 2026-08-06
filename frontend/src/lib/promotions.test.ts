import { describe, it, expect } from "vitest";
import {
  getActivePromotions,
  applyPromotions,
  getTotalDiscount,
  getCartTotal,
  type CartItem,
  type Promotion,
  type PromotionRule,
} from "./promotions";

function makeRule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: "r1",
    variant_id: null,
    buy_qty: null,
    get_qty: null,
    discount_percent: null,
    combo_price: null,
    category: null,
    variant_size: null,
    ...overrides,
  };
}

function makePromo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "p1",
    name: "Promo test",
    type: "PERCENTAGE",
    days_of_week: [],
    start_date: "2020-01-01",
    end_date: "2030-12-31",
    branch_id: null,
    active: true,
    promotion_rules: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    variant_id: "v-pizza",
    qty: 1,
    unit_price: 70,
    product_name: "Hawaiana",
    variant_name: "Familiar",
    category: "pizza",
    ...overrides,
  };
}

// Wednesday 2026-06-10 in local time (getDay() === 3)
const WEDNESDAY = new Date(2026, 5, 10, 12, 0, 0);

describe("getActivePromotions", () => {
  it("excludes inactive promotions", () => {
    const promos = [makePromo({ active: false })];
    expect(getActivePromotions(promos, "b1", WEDNESDAY)).toHaveLength(0);
  });

  it("excludes promotions scoped to another branch", () => {
    const promos = [makePromo({ branch_id: "b1" })];
    expect(getActivePromotions(promos, "b2", WEDNESDAY)).toHaveLength(0);
    expect(getActivePromotions(promos, "b1", WEDNESDAY)).toHaveLength(1);
  });

  it("includes promotions without branch for any branch", () => {
    const promos = [makePromo({ branch_id: null })];
    expect(getActivePromotions(promos, "b9", WEDNESDAY)).toHaveLength(1);
  });

  it("excludes promotions outside the date range", () => {
    const notStarted = makePromo({ start_date: "2026-06-11", end_date: "2026-06-30" });
    const ended = makePromo({ start_date: "2026-01-01", end_date: "2026-06-09" });
    const current = makePromo({ start_date: "2026-06-10", end_date: "2026-06-10" });
    expect(getActivePromotions([notStarted, ended, current], "b1", WEDNESDAY)).toEqual([current]);
  });

  it("filters by day of week when days_of_week is set", () => {
    const tuesdayOnly = makePromo({ days_of_week: [2] });
    const wednesdayOnly = makePromo({ days_of_week: [3] });
    const everyDay = makePromo({ days_of_week: [] });
    const active = getActivePromotions([tuesdayOnly, wednesdayOnly, everyDay], "b1", WEDNESDAY);
    expect(active).toEqual([wednesdayOnly, everyDay]);
  });
});

describe("applyPromotions — BUY_X_GET_Y", () => {
  const promo2x1 = makePromo({
    type: "BUY_X_GET_Y",
    name: "Martes 2x1",
    promotion_rules: [makeRule({ variant_id: "v-pizza", buy_qty: 1, get_qty: 1 })],
  });

  it("2x1: paying 1 unit sends 2 to the kitchen and discounts one", () => {
    const [item] = applyPromotions([makeItem({ qty: 1, unit_price: 70 })], [promo2x1]);
    expect(item.qty_physical).toBe(2);
    expect(item.discount_applied).toBe(70);
    expect(item.promo_label).toContain("2x1");
    // customer pays exactly one pizza
    expect(getCartTotal([item])).toBe(70);
  });

  it("2x1 with qty 2 doubles the free units", () => {
    const [item] = applyPromotions([makeItem({ qty: 2, unit_price: 70 })], [promo2x1]);
    expect(item.qty_physical).toBe(4);
    expect(item.discount_applied).toBe(140);
    expect(getCartTotal([item])).toBe(140);
  });

  it("does not apply when qty is below buy_qty", () => {
    const promo3x2 = makePromo({
      type: "BUY_X_GET_Y",
      promotion_rules: [makeRule({ variant_id: "v-pizza", buy_qty: 2, get_qty: 1 })],
    });
    const [item] = applyPromotions([makeItem({ qty: 1 })], [promo3x2]);
    expect(item.qty_physical).toBe(1);
    expect(item.discount_applied).toBe(0);
    expect(item.promo_label).toBeNull();
  });

  it("ignores items not targeted by the rule", () => {
    const [drink] = applyPromotions([makeItem({ variant_id: "v-coca", category: "bebida" })], [promo2x1]);
    expect(drink.discount_applied).toBe(0);
  });
});

describe("applyPromotions — PERCENTAGE", () => {
  it("applies percentage to a specific variant when the item is tagged with the promo", () => {
    const promo = makePromo({
      promotion_rules: [makeRule({ variant_id: "v-pizza", discount_percent: 10 })],
    });
    const [item] = applyPromotions([makeItem({ qty: 2, unit_price: 70, promo_id: promo.id })], [promo]);
    expect(item.discount_applied).toBeCloseTo(14);
    expect(item.final_price).toBeCloseTo(63);
    expect(getCartTotal([item])).toBeCloseTo(126);
  });

  it("does NOT discount a matching item added without going through the promo (Ventas tab)", () => {
    const promo = makePromo({
      promotion_rules: [makeRule({ variant_id: "v-pizza", discount_percent: 10 })],
    });
    const [item] = applyPromotions([makeItem({ qty: 2, unit_price: 70 })], [promo]);
    expect(item.discount_applied).toBe(0);
    expect(item.final_price).toBe(70);
    expect(item.promo_label).toBeNull();
  });

  it("applies to every tagged item when rule has no variant", () => {
    const promo = makePromo({
      promotion_rules: [makeRule({ discount_percent: 50 })],
    });
    const items = applyPromotions(
      [
        makeItem({ unit_price: 70, promo_id: promo.id }),
        makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida", promo_id: promo.id }),
      ],
      [promo]
    );
    expect(items[0].discount_applied).toBeCloseTo(35);
    expect(items[1].discount_applied).toBeCloseTo(5);
    expect(getTotalDiscount(items)).toBeCloseTo(40);
  });

  it("a whole-cart rule ignores items not tagged with the promo", () => {
    const promo = makePromo({
      promotion_rules: [makeRule({ discount_percent: 50 })],
    });
    const items = applyPromotions(
      [makeItem({ unit_price: 70, promo_id: promo.id }), makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida" })],
      [promo]
    );
    expect(items[0].discount_applied).toBeCloseTo(35);
    expect(items[1].discount_applied).toBe(0);
  });

  it("keeps the best discount instead of stacking when multiple rules of the same promo match", () => {
    const promo = makePromo({
      name: "Promo variada",
      promotion_rules: [
        makeRule({ id: "r1", discount_percent: 10 }), // applies to everyone
        makeRule({ id: "r2", variant_id: "v-pizza", discount_percent: 30 }), // more specific, higher discount
      ],
    });
    const [item] = applyPromotions([makeItem({ unit_price: 100, promo_id: promo.id })], [promo]);
    expect(item.discount_applied).toBeCloseTo(30);
    expect(item.promo_label).toContain("Promo variada");
  });
});

describe("applyPromotions — COMBO", () => {
  const comboRules = [
    makeRule({ id: "r1", variant_id: "v-pizza", combo_price: 60 }),
    makeRule({ id: "r2", variant_id: "v-coca" }),
  ];

  it("applies combo price split proportionally between items", () => {
    const items = applyPromotions(
      [makeItem({ unit_price: 70 }), makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida" })],
      [makePromo({ type: "COMBO", promotion_rules: comboRules })]
    );
    // original 80 → combo 60 → 20 discount split 70/80 and 10/80
    expect(items[0].discount_applied).toBeCloseTo(17.5);
    expect(items[1].discount_applied).toBeCloseTo(2.5);
    expect(getTotalDiscount(items)).toBeCloseTo(20);
    expect(getCartTotal(items)).toBeCloseTo(60);
  });

  it("does nothing when the combo is incomplete", () => {
    const items = applyPromotions(
      [makeItem({ unit_price: 70 })], // missing the drink
      [makePromo({ type: "COMBO", promotion_rules: comboRules })]
    );
    expect(items[0].discount_applied).toBe(0);
    expect(items[0].promo_label).toBeNull();
  });

  it("does nothing when combo price is not cheaper", () => {
    const expensiveCombo = [
      makeRule({ variant_id: "v-pizza", combo_price: 100 }),
      makeRule({ variant_id: "v-coca" }),
    ];
    const items = applyPromotions(
      [makeItem({ unit_price: 70 }), makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida" })],
      [makePromo({ type: "COMBO", promotion_rules: expensiveCombo })]
    );
    expect(getTotalDiscount(items)).toBe(0);
  });

  it("splits an item when only part of its qty joins the combo", () => {
    const items = applyPromotions(
      [makeItem({ qty: 2, unit_price: 70 }), makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida" })],
      [makePromo({ type: "COMBO", promotion_rules: comboRules })]
    );
    // pizza split: 1 unit in combo + 1 unit at full price, drink in combo
    expect(items).toHaveLength(3);
    const comboSlice = items.find((i) => i.variant_id === "v-pizza" && i.promo_label);
    const remainder = items.find((i) => i.variant_id === "v-pizza" && !i.promo_label);
    expect(comboSlice?.qty).toBe(1);
    expect(remainder?.qty).toBe(1);
    expect(remainder?.discount_applied).toBe(0);
    // total: combo 60 + extra pizza 70
    expect(getCartTotal(items)).toBeCloseTo(130);
  });

  it("matches flexible rules by category and size", () => {
    const flexibleRules = [
      makeRule({ category: "pizza", variant_size: "Familiar", combo_price: 60 }),
      makeRule({ category: "bebida" }),
    ];
    const items = applyPromotions(
      [
        makeItem({ unit_price: 70, variant_name: "Familiar" }),
        makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida", variant_name: "2L" }),
      ],
      [makePromo({ type: "COMBO", promotion_rules: flexibleRules })]
    );
    expect(getTotalDiscount(items)).toBeCloseTo(20);
  });

  it("flexible combo does not match a different size", () => {
    const flexibleRules = [
      makeRule({ category: "pizza", variant_size: "Familiar", combo_price: 60 }),
      makeRule({ category: "bebida" }),
    ];
    const items = applyPromotions(
      [
        makeItem({ unit_price: 40, variant_name: "Personal" }),
        makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida" }),
      ],
      [makePromo({ type: "COMBO", promotion_rules: flexibleRules })]
    );
    expect(getTotalDiscount(items)).toBe(0);
  });
});

describe("cart totals", () => {
  it("getCartTotal sums physical units minus discounts", () => {
    const items = applyPromotions(
      [makeItem({ qty: 1, unit_price: 70 }), makeItem({ variant_id: "v-coca", unit_price: 10, category: "bebida" })],
      []
    );
    expect(getCartTotal(items)).toBe(80);
    expect(getTotalDiscount(items)).toBe(0);
  });
});
