// Pure decision logic for the offline sales queue. No IndexedDB, no fetch, no
// React — so the rules that decide whether a sale is retried, parked or given
// a ticket number can be unit tested on their own.

/** How many numbers a device reserves at a time. */
export const NUMBER_BLOCK_SIZE = 50;

/** Reserve a fresh block once this few numbers are left, while still online. */
export const NUMBER_BLOCK_LOW_WATERMARK = 10;

export interface NumberBlock {
  branchId: string;
  day: string;
  rangeStart: number;
  rangeEnd: number;
  /** Next number to hand out; past rangeEnd means the block is spent. */
  nextNumber: number;
}

export type QueuedSaleStatus = "pending" | "conflict";

export interface QueuedSale {
  /** Primary key — also the server-side idempotency key. */
  idempotencyKey: string;
  branchId: string;
  dailyNumber: number;
  /** Request body for POST /orders, built when the sale was confirmed. */
  payload: unknown;
  createdAt: number;
  attempts: number;
  /** When the last sync attempt ran — the reference for the backoff. */
  lastAttemptAt: number | null;
  status: QueuedSaleStatus;
  lastError: string | null;
}

/**
 * Backoff before the next sync attempt. Caps at ~2 min so a device that has
 * been offline for an hour still reacts quickly once the network returns.
 */
export function nextBackoffMs(attempts: number): number {
  const base = 5_000 * 2 ** Math.max(0, attempts - 1);
  return Math.min(base, 120_000);
}

export function isBlockExhausted(block: NumberBlock): boolean {
  return block.nextNumber > block.rangeEnd;
}

export function remainingInBlock(block: NumberBlock): number {
  return Math.max(0, block.rangeEnd - block.nextNumber + 1);
}

export function isBlockRunningLow(block: NumberBlock): boolean {
  return remainingInBlock(block) <= NUMBER_BLOCK_LOW_WATERMARK;
}

/**
 * Takes the next ticket number from a block. Returns null when the block is
 * spent — the caller must reserve a new one, which needs the network, so a
 * device that burns through its range while offline cannot keep selling.
 */
export function takeNumber(
  block: NumberBlock,
): { number: number; block: NumberBlock } | null {
  if (isBlockExhausted(block)) return null;
  return {
    number: block.nextNumber,
    block: { ...block, nextNumber: block.nextNumber + 1 },
  };
}

/**
 * What to do with a sale whose sync attempt failed.
 *
 * - "retry"    → transient (network, timeout, 5xx). Keep it queued.
 * - "conflict" → the server rejected it on its merits (price/promo changed,
 *                number outside a reserved range). Retrying forever would
 *                never succeed, so it gets parked for a human to resolve.
 * - "done"     → already recorded server-side; drop it from the queue.
 */
export function classifySyncFailure(status: number | null): "retry" | "conflict" | "done" {
  // No HTTP status at all: the request never reached the server.
  if (status === null) return "retry";
  if (status === 200 || status === 201) return "done";
  if (status === 409 || status === 400 || status === 403 || status === 422) {
    return "conflict";
  }
  if (status === 401) return "retry"; // token refreshed on the next attempt
  if (status >= 500) return "retry";
  return "conflict";
}

export function isDueForRetry(sale: QueuedSale, now: number): boolean {
  if (sale.status !== "pending") return false;
  // Never attempted, or attempted before lastAttemptAt was ever written.
  if (sale.attempts === 0 || sale.lastAttemptAt === null) return true;
  return now - sale.lastAttemptAt >= nextBackoffMs(sale.attempts);
}
