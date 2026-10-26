import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nestFetch, RequestTimeoutError } from "./nestFetch";

vi.mock("./auth", () => ({ getToken: vi.fn().mockResolvedValue("test-token") }));

const originalFetch = global.fetch;

function okResponse(status = 200): Response {
  return new Response(JSON.stringify({ ok: true }), { status });
}

/** Never settles until aborted — stands in for a stalled TCP connection. */
function stalledFetch(): typeof global.fetch {
  return vi.fn((_url, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    }),
  ) as unknown as typeof global.fetch;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("nestFetch — timeout", () => {
  it("aborts a stalled request instead of hanging forever", async () => {
    global.fetch = stalledFetch();

    // retries: 0 so the assertion is about the timeout alone.
    const pending = nestFetch("/orders", { method: "POST" }, { timeoutMs: 1000, retries: 0 });
    const assertion = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("carries the configured timeout in the error", async () => {
    global.fetch = stalledFetch();

    const pending = nestFetch("/orders", { method: "POST" }, { timeoutMs: 2000, retries: 0 });
    const assertion = expect(pending).rejects.toMatchObject({ timeoutMs: 2000 });

    await vi.advanceTimersByTimeAsync(2000);
    await assertion;
  });
});

describe("nestFetch — retries", () => {
  it("retries a failed GET and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okResponse());
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const pending = nestFetch("/products");
    await vi.advanceTimersByTimeAsync(500);

    expect((await pending).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("NEVER retries a POST — it may already have been applied server-side", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(nestFetch("/orders", { method: "POST" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the worst case bounded for a read (2 attempts, not 3)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const pending = nestFetch("/products");
    const assertion = expect(pending).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured number of attempts", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const pending = nestFetch("/products", undefined, { retries: 2 });
    const assertion = expect(pending).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(500 + 1000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a 503 from the gateway", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(503))
      .mockResolvedValueOnce(okResponse());
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const pending = nestFetch("/products");
    await vi.advanceTimersByTimeAsync(500);

    expect((await pending).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(404));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    expect((await nestFetch("/products")).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("nestFetch — caller cancellation", () => {
  it("surfaces a caller abort without retrying", async () => {
    const fetchMock = vi.fn(stalledFetch());
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const controller = new AbortController();
    const pending = nestFetch("/products", { signal: controller.signal });
    const assertion = expect(pending).rejects.toThrow();

    controller.abort();
    await assertion;
    // Cancelled before the first attempt even went out (the abort can land
    // during the token lookup) — what matters is that it never retried.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("aborts an in-flight request when the caller cancels mid-request", async () => {
    const fetchMock = vi.fn(stalledFetch());
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const controller = new AbortController();
    const pending = nestFetch("/products", { signal: controller.signal });
    const assertion = expect(pending).rejects.toThrow();

    // Let the token resolve so fetch is genuinely in flight, then cancel —
    // this is the path that goes through the forwarded abort listener.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    controller.abort();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to start when the caller signal is already aborted", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(
      nestFetch("/products", { signal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("nestFetch — request shape", () => {
  it("attaches the bearer token and json content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await nestFetch("/products");

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
