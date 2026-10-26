"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MenuUnavailableError,
  PublicOrdersService,
} from "../services/public-orders.service";
import { addToCart, cartTotal, setQty } from "../lib/cart";
import { appendOrder, readOrderHistory, removeOrder } from "../lib/order-history";
import type {
  CartLine,
  CreateOnlineOrderResult,
  PublicMenu,
  PublicMenuProduct,
  PublicMenuVariant,
  PublicTab,
  StoredOrder,
} from "../types/online-orders.types";

// Owns the whole customer-side flow for one branch: load the menu, build a
// cart, submit, and keep a history of the customer's own orders so closing the
// tab and re-scanning the QR comes back to them instead of a blank menu.
//
// Status fetching is NOT here — it lives in useOrderStatus, per selected
// order, so the menu doesn't re-render when a status is refreshed.
export function usePublicOrderFlow(branchId: string) {
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [tab, setTab] = useState<PublicTab>("menu");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<CreateOnlineOrderResult | null>(null);

  const [history, setHistory] = useState<StoredOrder[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setUnavailable(false);
    try {
      setMenu(await PublicOrdersService.getMenu(branchId));
    } catch (err) {
      // Two genuinely different outcomes: "this QR is dead" (nothing the
      // customer can do) vs "the request failed" (retrying may work).
      if (err instanceof MenuUnavailableError) setUnavailable(true);
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  // Recover previous orders on mount. readOrderHistory never throws and also
  // migrates the single token the pre-history version stored.
  useEffect(() => {
    const stored = readOrderHistory(branchId);
    setHistory(stored);
    // Land on the orders tab when something is already waiting — that is what
    // the customer re-scanned the QR to check. The menu stays one tap away.
    if (stored.length > 0) {
      setSelectedToken(stored[0].token);
      setTab("orders");
    }
  }, [branchId]);

  const add = useCallback((product: PublicMenuProduct, variant: PublicMenuVariant) => {
    setCart((prev) => addToCart(prev, product, variant));
  }, []);

  const changeQty = useCallback((variantId: string, qty: number) => {
    setCart((prev) => setQty(prev, variantId, qty));
  }, []);

  const submit = useCallback(
    async (customer: { name: string; phone: string; notes: string }) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await PublicOrdersService.create({
          branch_id: branchId,
          customer_name: customer.name.trim(),
          customer_phone: customer.phone.trim(),
          notes: customer.notes.trim() || undefined,
          items: cart.map((line) => ({ variant_id: line.variant_id, qty: line.qty })),
        });

        setSubmitted(result);
        setHistory(
          appendOrder(branchId, {
            token: result.public_token,
            reference: result.reference,
            total: result.total,
            created_at: new Date().toISOString(),
          }),
        );
        setSelectedToken(result.public_token);
        setTab("orders");
        setCart([]);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "No se pudo enviar el pedido");
      } finally {
        setSubmitting(false);
      }
    },
    [branchId, cart],
  );

  /** Drops a stored order the server no longer knows about, so the list stays truthful. */
  const discardOrder = useCallback(
    (token: string) => {
      const next = removeOrder(branchId, token);
      setHistory(next);
      setSelectedToken(null);
      if (next.length === 0) setTab("menu");
    },
    [branchId],
  );

  return {
    menu,
    loading,
    unavailable,
    loadError,
    retryLoad: loadMenu,
    cart,
    total: cartTotal(cart),
    add,
    changeQty,
    tab,
    setTab,
    submit,
    submitting,
    submitError,
    submitted,
    history,
    selectedToken,
    selectOrder: setSelectedToken,
    backToList: useCallback(() => setSelectedToken(null), []),
    discardOrder,
  };
}
