"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import { useNewIdAlert } from "@/lib/useNewIdAlert";
import { notifyNewOrder } from "@/lib/notify";
import { OnlineOrdersService } from "../services/online-orders.service";
import type { OnlineOrderRow } from "../types/manage.types";

// Pending QR requests for one branch, kept live over the socket.
//
// No-ops entirely when `enabled` is false (the business doesn't have the
// onlineOrders module): no fetch, no socket, no interval. Same contract as
// useOfflineSales.
export function useOnlineOrders(branchId: string | undefined, enabled: boolean) {
  const [orders, setOrders] = useState<OnlineOrderRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof OnlineOrdersService.subscribe> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !branchId) return;
    setOrders(await OnlineOrdersService.list(branchId));
    setLoaded(true);
  }, [branchId, enabled]);

  useEffect(() => {
    if (!enabled || !branchId) {
      setOrders([]);
      setLoaded(false);
      return;
    }

    void refresh();

    // The socket event carries only badge-level data, so a new request triggers
    // a refetch rather than being pushed into the list — that keeps one source
    // of truth for the row shape (items, prices) and costs one cheap request
    // at the exact moment the cashier is about to look anyway.
    subscriptionRef.current = OnlineOrdersService.subscribe(branchId, {
      onCreated: () => void refresh(),
      onResolved: ({ id }) => setOrders((prev) => prev.filter((o) => o.id !== id)),
    });

    return () => {
      if (subscriptionRef.current) {
        OnlineOrdersService.unsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [branchId, enabled, refresh]);

  // Drops requests whose window closed while the tab sat open, without waiting
  // for the cron's socket event. Cheap, and it keeps the cashier from clicking
  // Confirm on something the backend will reject.
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setOrders((prev) => prev.filter((o) => new Date(o.expires_at).getTime() > now));
    }, 15_000);
    return () => clearInterval(interval);
  }, [enabled]);

  // Sound + vibration on a genuinely new request. `loaded` gates the baseline
  // so the requests already pending when the POS opened never beep.
  useNewIdAlert(
    orders.map((o) => o.id),
    notifyNewOrder,
    loaded && enabled,
  );

  const confirm = useCallback(
    async (id: string) => {
      setActing(id);
      try {
        const result = await OnlineOrdersService.confirm(id);
        setOrders((prev) => prev.filter((o) => o.id !== id));
        message.success(`Pedido confirmado — ticket #${result.daily_number}`);
        return result;
      } catch (err) {
        message.error(err instanceof Error ? err.message : "No se pudo confirmar");
        // Re-sync: the usual cause is "expired" or "already resolved by someone
        // else", and in both cases the local list is now wrong.
        void refresh();
        return null;
      } finally {
        setActing(null);
      }
    },
    [refresh],
  );

  const reject = useCallback(
    async (id: string, reason: string) => {
      setActing(id);
      try {
        await OnlineOrdersService.reject(id, reason);
        setOrders((prev) => prev.filter((o) => o.id !== id));
        message.success("Pedido rechazado");
        return true;
      } catch (err) {
        message.error(err instanceof Error ? err.message : "No se pudo rechazar");
        void refresh();
        return false;
      } finally {
        setActing(null);
      }
    },
    [refresh],
  );

  return { orders, loaded, acting, refresh, confirm, reject, count: orders.length };
}
