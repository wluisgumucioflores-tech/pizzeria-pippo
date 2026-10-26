import { describe, it, expect } from "vitest";
import {
  NUMBER_BLOCK_SIZE,
  classifySyncFailure,
  isBlockExhausted,
  isBlockRunningLow,
  isDueForRetry,
  nextBackoffMs,
  remainingInBlock,
  takeNumber,
  type NumberBlock,
  type QueuedSale,
} from "./offline-queue";

function block(overrides: Partial<NumberBlock> = {}): NumberBlock {
  return {
    branchId: "b1",
    day: "2026-10-25",
    rangeStart: 51,
    rangeEnd: 100,
    nextNumber: 51,
    ...overrides,
  };
}

function sale(overrides: Partial<QueuedSale> = {}): QueuedSale {
  return {
    idempotencyKey: "key-1",
    branchId: "b1",
    dailyNumber: 51,
    payload: {},
    createdAt: 0,
    attempts: 0,
    lastAttemptAt: null,
    status: "pending",
    lastError: null,
    ...overrides,
  };
}

describe("nextBackoffMs", () => {
  it("grows exponentially from 5s", () => {
    expect(nextBackoffMs(1)).toBe(5_000);
    expect(nextBackoffMs(2)).toBe(10_000);
    expect(nextBackoffMs(3)).toBe(20_000);
  });

  it("caps so a long outage still reacts fast when the network returns", () => {
    expect(nextBackoffMs(50)).toBe(120_000);
  });
});

describe("takeNumber", () => {
  it("hands out numbers in order and advances the block", () => {
    const first = takeNumber(block())!;
    expect(first.number).toBe(51);

    const second = takeNumber(first.block)!;
    expect(second.number).toBe(52);
  });

  it("does not mutate the block it was given", () => {
    const original = block();
    takeNumber(original);
    expect(original.nextNumber).toBe(51);
  });

  it("returns null once the range is spent, instead of reusing a number", () => {
    expect(takeNumber(block({ nextNumber: 101 }))).toBeNull();
  });

  it("hands out exactly the reserved range and no more", () => {
    let current = block({ rangeStart: 1, rangeEnd: NUMBER_BLOCK_SIZE, nextNumber: 1 });
    const handed: number[] = [];
    for (;;) {
      const taken = takeNumber(current);
      if (!taken) break;
      handed.push(taken.number);
      current = taken.block;
    }
    expect(handed).toHaveLength(NUMBER_BLOCK_SIZE);
    expect(handed[handed.length - 1]).toBe(NUMBER_BLOCK_SIZE);
  });
});

describe("block accounting", () => {
  it("counts what is left", () => {
    expect(remainingInBlock(block({ nextNumber: 51 }))).toBe(50);
    expect(remainingInBlock(block({ nextNumber: 100 }))).toBe(1);
    expect(remainingInBlock(block({ nextNumber: 101 }))).toBe(0);
  });

  it("flags a spent block", () => {
    expect(isBlockExhausted(block({ nextNumber: 100 }))).toBe(false);
    expect(isBlockExhausted(block({ nextNumber: 101 }))).toBe(true);
  });

  it("warns early so a new block can be reserved while still online", () => {
    expect(isBlockRunningLow(block({ nextNumber: 51 }))).toBe(false);
    expect(isBlockRunningLow(block({ nextNumber: 91 }))).toBe(true);
  });
});

describe("classifySyncFailure", () => {
  it("retries when the request never reached the server", () => {
    expect(classifySyncFailure(null)).toBe("retry");
  });

  it("retries server and auth errors", () => {
    expect(classifySyncFailure(500)).toBe("retry");
    expect(classifySyncFailure(503)).toBe("retry");
    expect(classifySyncFailure(401)).toBe("retry");
  });

  it("treats an accepted sale as done", () => {
    // 200 is the idempotency-key hit: the server already had this sale.
    expect(classifySyncFailure(200)).toBe("done");
    expect(classifySyncFailure(201)).toBe("done");
  });

  it("parks a sale the server rejected on its merits", () => {
    // 409 is the price/promo mismatch — retrying would never succeed.
    expect(classifySyncFailure(409)).toBe("conflict");
    expect(classifySyncFailure(400)).toBe("conflict");
    expect(classifySyncFailure(403)).toBe("conflict");
  });
});

describe("isDueForRetry", () => {
  it("sends a brand new sale immediately", () => {
    expect(isDueForRetry(sale(), 0)).toBe(true);
  });

  it("waits out the backoff measured from the last attempt", () => {
    const retried = sale({ attempts: 1, lastAttemptAt: 1_000 });
    expect(isDueForRetry(retried, 5_000)).toBe(false);
    expect(isDueForRetry(retried, 6_000)).toBe(true);
  });

  it("never retries a parked conflict on its own", () => {
    expect(
      isDueForRetry(sale({ status: "conflict", attempts: 3, lastAttemptAt: 0 }), 1e9),
    ).toBe(false);
  });
});
