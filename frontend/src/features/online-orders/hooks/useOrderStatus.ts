"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicOrdersService } from "../services/public-orders.service";
import type { OnlineOrderStatusResult } from "../types/online-orders.types";

// Reads the public status endpoint ON DEMAND. No interval, no WebSocket.
//
// It used to poll every 5s. That is the expensive pattern at this scale: a
// thousand customers waiting for confirmation is ~200 req/s against a public,
// unauthenticated endpoint, sustained for as long as their tabs stay open and
// paid whether anything changed or not. An idle WebSocket would actually have
// been cheaper — but it's not an option either, because OrdersGateway requires
// a JWT in the handshake and the customer has none.
//
// So the refresh is driven by three things, all of which cost nothing while
// idle:
//   1. opening the screen (one request),
//   2. the customer tapping "Actualizar",
//   3. the tab regaining focus — which is exactly the WhatsApp round-trip,
//      the moment the status is most likely to have changed.
export function useOrderStatus(token: string | null) {
  const [status, setStatus] = useState<OnlineOrderStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  // Once the order is resolved its status can't change again, so a focus
  // event must not fire another request.
  const isFinalRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const result = await PublicOrdersService.getStatus(token);
      if (result === null) {
        // Stale token (a previous day, or a deleted order) — tell the page to
        // offer a fresh start rather than spinning forever.
        setNotFound(true);
        isFinalRef.current = true;
        return;
      }
      setStatus(result);
      setError(false);
      setLastUpdatedAt(Date.now());
      isFinalRef.current = result.status !== "pending";
    } catch {
      // Not fatal: the customer can tap again. The flag only drives a quiet
      // hint, not an error screen.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /** Button-driven refresh — same request, but with its own spinner state. */
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchStatus();
    } finally {
      setRefreshing(false);
    }
  }, [fetchStatus, refreshing]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    isFinalRef.current = false;
    setLoading(true);
    setNotFound(false);
    void fetchStatus();
  }, [token, fetchStatus]);

  // Refresh when the customer comes back to the tab — typically straight from
  // sending the WhatsApp message. Skipped once the order is resolved.
  useEffect(() => {
    if (!token) return;

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (isFinalRef.current) return;
      void fetchStatus();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [token, fetchStatus]);

  return { status, loading, refreshing, notFound, error, lastUpdatedAt, refresh };
}
