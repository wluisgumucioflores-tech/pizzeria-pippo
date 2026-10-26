"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { computeChange, suggestCashAmounts } from "@/lib/cash-change";

/**
 * Cashier-facing change calculator. `amountDue` is the cash the customer hands
 * over for (the whole total, or just the cash leg of a split payment) — pass
 * null when the payment produces no change and the UI should stay hidden.
 *
 * Nothing here is persisted: it exists so the cashier doesn't do the math in
 * their head while the customer waits.
 */
export function useCashChange(amountDue: number | null) {
  const [received, setReceived] = useState<number | null>(null);

  // Switching payment method or editing the cash leg changes what's owed, so
  // a stale amount would show a wrong change. Clearing is the safe default.
  useEffect(() => {
    setReceived(null);
  }, [amountDue]);

  const change = amountDue === null ? null : computeChange(received, amountDue);
  const insufficient = change !== null && change < 0;

  const suggestions = useMemo(
    () => (amountDue === null ? [] : suggestCashAmounts(amountDue)),
    [amountDue],
  );

  const reset = useCallback(() => setReceived(null), []);

  return { received, setReceived, change, insufficient, suggestions, reset };
}
