import {
  MAX_STORED_ORDERS,
  ORDER_HISTORY_TTL_DAYS,
  legacyTokenStorageKey,
  orderHistoryStorageKey,
} from "../constants/online-orders.constants";
import type { StoredOrder } from "../types/online-orders.types";

// The customer's own order history, kept in their browser. There is no
// customer account anywhere in the system — the public token IS the only
// credential — so localStorage is the only place this can live.
//
// Every function here fails SOFT: localStorage throws outright in some privacy
// modes, and a customer who can't store history must still be able to order.

function isFresh(order: StoredOrder, at: number): boolean {
  const created = Date.parse(order.created_at);
  if (Number.isNaN(created)) return false;
  return at - created < ORDER_HISTORY_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/** Rejects anything that isn't a well-formed entry, so corrupt storage can't crash the page. */
function isStoredOrder(value: unknown): value is StoredOrder {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.token === "string" &&
    candidate.token !== "" &&
    typeof candidate.reference === "string" &&
    typeof candidate.total === "number" &&
    typeof candidate.created_at === "string"
  );
}

/**
 * Newest first, stale entries dropped. An order older than the TTL is gone
 * server-side anyway (it was confirmed and closed, or it expired), so keeping
 * it would only produce "no encontramos tu pedido" rows.
 */
export function readOrderHistory(branchId: string): StoredOrder[] {
  try {
    const raw = localStorage.getItem(orderHistoryStorageKey(branchId));
    const migrated = migrateLegacyToken(branchId);

    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.filter(isStoredOrder) : [];

    const at = Date.now();
    const fresh = [...migrated, ...list].filter((order) => isFresh(order, at));

    // De-dup by token — the legacy migration can overlap with the new list.
    const byToken = new Map<string, StoredOrder>();
    for (const order of fresh) {
      if (!byToken.has(order.token)) byToken.set(order.token, order);
    }

    return Array.from(byToken.values())
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, MAX_STORED_ORDERS);
  } catch {
    return [];
  }
}

/**
 * Carries over the single token stored by the pre-history version, so a
 * customer who ordered before this change doesn't lose that order. Reads it
 * once and deletes it.
 */
function migrateLegacyToken(branchId: string): StoredOrder[] {
  try {
    const legacy = localStorage.getItem(legacyTokenStorageKey(branchId));
    if (legacy === null || legacy === "") return [];
    localStorage.removeItem(legacyTokenStorageKey(branchId));
    return [
      {
        token: legacy,
        // The old key stored only the token — reference and total are unknown
        // until the status endpoint answers, and created_at is assumed "now"
        // so the TTL doesn't drop it immediately.
        reference: "",
        total: 0,
        created_at: new Date().toISOString(),
      },
    ];
  } catch {
    return [];
  }
}

export function appendOrder(branchId: string, order: StoredOrder): StoredOrder[] {
  const next = [order, ...readOrderHistory(branchId).filter((o) => o.token !== order.token)].slice(
    0,
    MAX_STORED_ORDERS,
  );
  writeOrderHistory(branchId, next);
  return next;
}

export function removeOrder(branchId: string, token: string): StoredOrder[] {
  const next = readOrderHistory(branchId).filter((order) => order.token !== token);
  writeOrderHistory(branchId, next);
  return next;
}

function writeOrderHistory(branchId: string, orders: StoredOrder[]): void {
  try {
    localStorage.setItem(orderHistoryStorageKey(branchId), JSON.stringify(orders));
  } catch {
    // Out of quota or storage denied. The orders still exist server-side; the
    // customer just loses the list if they close the tab. Not worth failing on.
  }
}
