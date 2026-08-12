"use client";

import { useState } from "react";
import { usePosIdentity } from "@/features/pos/hooks/usePosIdentity";
import { usePosProducts } from "@/features/pos/hooks/usePosProducts";
import { generateUUID } from "@/lib/uuid";
import { useMeseroCart } from "./useMeseroCart";
import { useMeseroOrders } from "./useMeseroOrders";
import { useMeseroName } from "./useMeseroName";
import { MeseroService } from "../services/mesero.service";

export type MeseroTab = "nuevo" | "mis-pedidos";

export function useMeseroPage() {
  const { identity, effectiveBranchId } = usePosIdentity();
  const { name: waiterName } = useMeseroName();
  const { products, loading: loadingProducts, getVariantPrice, getStockQty } = usePosProducts(effectiveBranchId ?? undefined);
  const cart = useMeseroCart();
  const { myOrders, loading: loadingOrders, refresh: refreshOrders, connected } = useMeseroOrders(effectiveBranchId ?? undefined, waiterName);
  const [tab, setTab] = useState<MeseroTab>("nuevo");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleProductClick = (product: (typeof products)[number]) => {
    const variant = product.product_variants[0];
    if (!variant || !effectiveBranchId) return;
    cart.addToCart(product, variant, getVariantPrice(variant, effectiveBranchId));
  };

  const handleSubmitOrder = async () => {
    if (!effectiveBranchId || !waiterName || cart.items.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await MeseroService.createOrder({
      branchId: effectiveBranchId,
      items: cart.items,
      total: cart.total,
      orderType: "dine_in",
      tableNumber: cart.tableNumber.trim() || null,
      waiterName,
      idempotencyKey: generateUUID(),
    });

    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "No se pudo enviar el pedido");
      return;
    }
    cart.clearCart();
    refreshOrders();
    setTab("mis-pedidos");
  };

  return {
    identity, effectiveBranchId, waiterName,
    products, loadingProducts, getVariantPrice, getStockQty,
    cart, myOrders, loadingOrders, connected,
    tab, setTab, submitting, submitError, handleProductClick, handleSubmitOrder,
  };
}
