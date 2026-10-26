// Change ("vuelto") calculation for cash sales. Pure helpers, no state and no
// React — the POS only ever uses these to show the cashier how much to hand
// back; nothing here is persisted or sent to the backend.

// Bolivian bills in circulation. Coins (1, 2, 5) are deliberately left out of
// the quick-pick row: nobody hands over a coin to cover a pizza.
export const CASH_DENOMINATIONS = [10, 20, 50, 100, 200];

// Round to cents. Subtracting floats (200 - 150.5) otherwise leaks artifacts
// like 49.499999999999996 straight into the amount shown to the cashier.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How much cash the customer physically hands over for this sale, or null when
 * the payment produces no change at all.
 *
 * - efectivo → the whole total
 * - mixto    → only the cash leg (the QR leg never produces change)
 * - qr / online (Pedidos Ya) / null (por cobrar) → no change
 */
export function cashDueFor(
  method: 'efectivo' | 'qr' | 'online' | 'mixto' | null,
  total: number,
  payments?: { method: 'efectivo' | 'qr'; amount: number }[] | null,
): number | null {
  if (method === 'efectivo') return total > 0 ? round2(total) : null;
  if (method === 'mixto') {
    const cashLeg = payments?.find((p) => p.method === 'efectivo')?.amount ?? 0;
    return cashLeg > 0 ? round2(cashLeg) : null;
  }
  return null;
}

/**
 * Change owed back. Returns null when nothing was entered yet, and a negative
 * number when the amount handed over does not cover what is due — the caller
 * decides how to surface that (the POS shows it as "falta", never as change).
 */
export function computeChange(
  cashReceived: number | null,
  amountDue: number,
): number | null {
  if (cashReceived === null) return null;
  return round2(cashReceived - amountDue);
}

/**
 * Amounts worth offering as one-tap buttons for a given bill to break.
 *
 * Two sources, deduplicated: the real bills that are bigger than the amount
 * due, and the next round figure at 50/100 (which covers paying with several
 * bills, e.g. two 100s for a 150 total). Capped so the row stays tappable.
 */
export function suggestCashAmounts(amountDue: number, limit = 3): number[] {
  if (amountDue <= 0) return [];
  const candidates = new Set<number>();

  for (const bill of CASH_DENOMINATIONS) {
    if (bill > amountDue) candidates.add(bill);
  }
  for (const step of [50, 100]) {
    const rounded = Math.ceil(amountDue / step) * step;
    if (rounded > amountDue) candidates.add(rounded);
  }

  return Array.from(candidates)
    .sort((a, b) => a - b)
    .slice(0, limit);
}
