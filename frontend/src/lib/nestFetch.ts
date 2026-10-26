import { getToken } from "./auth";

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL;

// A fetch with no signal waits for the browser's own default (90-300s) and can
// stall indefinitely on a TCP connection that stays open but stops moving.
// That is what branches on slow connections reported as the POS "freezing" for
// a minute or more, so every call through here gets a ceiling.
// Writes get a single generous attempt. Reads get a shorter one because they
// are retried, and the WORST CASE has to stay bounded: 10s + 0.5s + 10s is
// ~20s, whereas three 15s attempts would have been 46s — worse than the hang
// this is meant to fix.
const DEFAULT_WRITE_TIMEOUT_MS = 15_000;
const DEFAULT_READ_TIMEOUT_MS = 10_000;

// GET is idempotent by HTTP semantics, so retrying one can never double-write.
// Anything else is NEVER retried automatically: a POST that timed out may well
// have been applied server-side already, and replaying it blindly would
// duplicate the write. Callers that are safe to replay (the sale, which
// carries an idempotency key) retry on their own terms.
const DEFAULT_GET_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 500;

// Gateway errors from Traefik under load are transient and worth one more try;
// a 4xx or a plain 500 is not.
const RETRYABLE_STATUSES = [502, 503, 504];

export class RequestTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`La solicitud superó ${timeoutMs / 1000}s sin respuesta.`);
    this.name = "RequestTimeoutError";
  }
}

export interface NestFetchOptions {
  /** Ceiling for the whole exchange, headers and body. */
  timeoutMs?: number;
  /** Extra attempts after the first. Defaults to 2 for GET, 0 otherwise. */
  retries?: number;
}

function isGet(init?: RequestInit): boolean {
  return (init?.method?.toUpperCase() ?? "GET") === "GET";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function nestFetch(
  path: string,
  init?: RequestInit,
  options?: NestFetchOptions,
): Promise<Response> {
  const read = isGet(init);
  const timeoutMs =
    options?.timeoutMs ??
    (read ? DEFAULT_READ_TIMEOUT_MS : DEFAULT_WRITE_TIMEOUT_MS);
  const maxRetries = options?.retries ?? (read ? DEFAULT_GET_RETRIES : 0);
  const callerSignal = init?.signal;

  let lastError: unknown = new RequestTimeoutError(timeoutMs);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (callerSignal?.aborted) throw callerSignal.reason ?? new Error("Cancelado");

    const token = await getToken();
    // getToken() is async, so the caller may have cancelled while we were
    // suspended above — before the listener below existed. Without this check
    // that abort would be silently lost and the request would go out anyway.
    if (callerSignal?.aborted) throw callerSignal.reason ?? new Error("Cancelado");

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = () => controller.abort();
    callerSignal?.addEventListener("abort", forwardAbort);

    try {
      const response = await fetch(`${NEST_API_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
      });

      if (RETRYABLE_STATUSES.includes(response.status) && attempt < maxRetries) {
        clearTimeout(timer);
        callerSignal?.removeEventListener("abort", forwardAbort);
        lastError = new Error(`HTTP ${response.status}`);
        await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      // The timer is deliberately NOT cleared here. fetch() resolves as soon as
      // the headers arrive, so the body is still being read by the caller via
      // res.json() — leaving the timer armed is what gives that read a deadline
      // too. Once the body is consumed the pending abort is a harmless no-op.
      callerSignal?.removeEventListener("abort", forwardAbort);
      return response;
    } catch (err) {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", forwardAbort);

      // Cancelled by the caller, not by us — surface it as-is, never retry.
      if (callerSignal?.aborted) throw callerSignal.reason ?? err;

      lastError = timedOut ? new RequestTimeoutError(timeoutMs) : err;
      if (attempt === maxRetries) break;
      await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError;
}
