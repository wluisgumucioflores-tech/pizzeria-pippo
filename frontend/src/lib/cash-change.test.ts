import { describe, it, expect } from "vitest";
import { cashDueFor, computeChange, suggestCashAmounts } from "./cash-change";

describe("cashDueFor", () => {
  it("charges the whole total in a cash sale", () => {
    expect(cashDueFor("efectivo", 150)).toBe(150);
  });

  it("uses only the cash leg of a split payment", () => {
    const payments = [
      { method: "efectivo" as const, amount: 100 },
      { method: "qr" as const, amount: 50 },
    ];
    expect(cashDueFor("mixto", 150, payments)).toBe(100);
  });

  it("returns null for payments that never produce change", () => {
    expect(cashDueFor("qr", 150)).toBeNull();
    // Pedidos Ya — already paid online, the cashier handles no money.
    expect(cashDueFor("online", 150)).toBeNull();
    // "Por cobrar" — no payment happened yet.
    expect(cashDueFor(null, 150)).toBeNull();
  });

  it("returns null for a split payment with no cash leg", () => {
    expect(cashDueFor("mixto", 150, [{ method: "qr", amount: 150 }])).toBeNull();
  });

  it("returns null instead of zero for an empty total", () => {
    expect(cashDueFor("efectivo", 0)).toBeNull();
  });
});

describe("computeChange", () => {
  it("returns the change owed back", () => {
    expect(computeChange(200, 150)).toBe(50);
  });

  it("returns null while nothing was entered", () => {
    expect(computeChange(null, 150)).toBeNull();
  });

  it("returns zero when the customer pays the exact amount", () => {
    expect(computeChange(150, 150)).toBe(0);
  });

  it("goes negative when the amount does not cover the total", () => {
    expect(computeChange(100, 150)).toBe(-50);
  });

  it("rounds away float artifacts", () => {
    // 200 - 150.5 is 49.499999999999996 in raw floating point.
    expect(computeChange(200, 150.5)).toBe(49.5);
  });
});

describe("suggestCashAmounts", () => {
  it("offers the bills above the amount due", () => {
    expect(suggestCashAmounts(37)).toEqual([50, 100, 200]);
  });

  it("adds the next round figure when no single bill is close", () => {
    // 85 → 100 is both a bill and the round-up; 200 is the next bill.
    expect(suggestCashAmounts(85)).toEqual([100, 200]);
  });

  it("offers the single sensible bill for a round total", () => {
    expect(suggestCashAmounts(150)).toEqual([200]);
  });

  it("never suggests an amount that fails to cover the total", () => {
    for (const amount of suggestCashAmounts(150)) {
      expect(amount).toBeGreaterThan(150);
    }
  });

  it("caps how many buttons it returns", () => {
    expect(suggestCashAmounts(5, 2)).toHaveLength(2);
  });

  it("returns nothing for an empty amount", () => {
    expect(suggestCashAmounts(0)).toEqual([]);
  });
});
