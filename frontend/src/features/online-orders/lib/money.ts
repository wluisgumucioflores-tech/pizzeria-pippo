// Single money formatter for the public QR page. It existed inline in four
// different components as `{price} Bs`, which printed "9.9 Bs" and "1500 Bs" —
// inconsistent with every other screen in the system.
//
// Format matches the POS and the printed ticket (`Bs 75.00`) on purpose: the
// customer compares the price on their phone with the one the cashier charges,
// so the two must look identical.

export function formatMoney(value: number): string {
  // A NaN/Infinity price would render "Bs NaN" to a customer. Falling back to
  // zero is wrong-but-harmless; the server is the authority on the total.
  const safe = Number.isFinite(value) ? value : 0;
  return `Bs ${safe.toFixed(2)}`;
}

/** Line total, rounded the same way the cart and the server round it. */
export function formatLineTotal(unitPrice: number, qty: number): string {
  return formatMoney(Math.round(unitPrice * qty * 100) / 100);
}
