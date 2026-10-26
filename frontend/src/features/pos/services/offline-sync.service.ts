import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { classifySyncFailure, isDueForRetry, type QueuedSale } from "@/lib/offline-queue";
import { OfflineSalesService } from "./offline-sales.service";

/**
 * Drains the queued sales into the server, one at a time.
 *
 * Module-level singleton on purpose: the POS can re-render or navigate between
 * tabs freely, and there must never be two drains racing on the same queue
 * (both would POST the same sale — harmless thanks to the idempotency key, but
 * it would double the traffic on the very connection that is already slow).
 */

let draining = false;
let listeners: (() => void)[] = [];

export type SyncSnapshot = {
  pending: number;
  conflicts: number;
  oldestPendingAt: number | null;
};

function notify(): void {
  for (const listener of listeners) listener();
}

export const OfflineSyncService = {
  subscribe(listener: () => void): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  async snapshot(): Promise<SyncSnapshot> {
    const sales = await OfflineSalesService.list();
    const pending = sales.filter((s) => s.status === "pending");
    return {
      pending: pending.length,
      conflicts: sales.filter((s) => s.status === "conflict").length,
      oldestPendingAt: pending.length
        ? Math.min(...pending.map((s) => s.createdAt))
        : null,
    };
  },

  /** Sends one sale. Returns true when it left the queue. */
  async syncOne(sale: QueuedSale): Promise<boolean> {
    let status: number | null = null;
    try {
      const res = await nestFetch(API_ENDPOINTS.orders.base, {
        method: "POST",
        body: JSON.stringify(sale.payload),
      });
      status = res.status;
    } catch {
      status = null; // never reached the server
    }

    const outcome = classifySyncFailure(status);

    if (outcome === "done") {
      await OfflineSalesService.remove(sale.idempotencyKey);
      return true;
    }

    await OfflineSalesService.update({
      ...sale,
      attempts: sale.attempts + 1,
      lastAttemptAt: Date.now(),
      status: outcome === "conflict" ? "conflict" : "pending",
      lastError:
        outcome === "conflict"
          ? `El servidor rechazó la venta (HTTP ${status}). Revisala a mano.`
          : `Sin respuesta del servidor${status ? ` (HTTP ${status})` : ""}.`,
    });
    return false;
  },

  async drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      const sales = await OfflineSalesService.list();
      const now = Date.now();
      // Oldest first so ticket numbers reach the server roughly in order.
      const due = sales
        .filter((s) => isDueForRetry(s, now))
        .sort((a, b) => a.createdAt - b.createdAt);

      for (const sale of due) {
        const left = await this.syncOne(sale);
        notify();
        // One failure almost always means the connection is down — stop here
        // instead of hammering a dead link with the rest of the queue.
        if (!left) break;
      }
    } finally {
      draining = false;
      notify();
    }
  },
};
