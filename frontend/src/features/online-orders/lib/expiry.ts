// Minutes left before a pending request expires, for the countdown tag in the
// cashier's panel and the admin's list.
//
// Rounds UP and floors at 0: showing "0 min" for something with 40 seconds
// left would read as already expired, and a negative number is never useful —
// an overdue request is filtered out of the list anyway.
export function minutesLeft(expiresAt: string, now: number = Date.now()): number {
  const remaining = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return Math.ceil(remaining / 60_000);
}

export function isExpired(expiresAt: string, now: number = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= now;
}
