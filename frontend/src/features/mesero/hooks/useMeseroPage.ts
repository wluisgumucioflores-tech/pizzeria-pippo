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
  const { products, loading: loadingProducts, useStock, getVariantPrice, getStockQty } = usePosProducts(effectiveBranchId ?? undefined);
  const cart = useMeseroCart();
  const { myOrders, loading: loadingOrders, refresh: refreshOrders, connected } = useMeseroOrders(effectiveBranchId ?? undefined, waiterName);
  const [tab, setTab] = useState<MeseroTab>("nuevo");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Fase 2 (docs/features/mesero-y-mejoras-pos/) — agregar items a un pedido
  // propio mientras siga "Pendiente" en cocina. Reusa el mismo carrito/catálogo
  // que "Nuevo pedido"; solo cambia adónde va el submit.
  const [addingToOrder, setAddingToOrder] = useState<{ id: string; dailyNumber: number } | null>(null);

  const startAddItems = (orderId: string, dailyNumber: number) => {
    cart.clearCart();
    setAddingToOrder({ id: orderId, dailyNumber });
    setTab("nuevo");
  };

  const cancelAddItems = () => {
    cart.clearCart();
    setAddingToOrder(null);
    setTab("mis-pedidos");
  };

  const handleProductClick = (product: (typeof products)[number]) => {
    const variant = product.product_variants[0];
    if (!variant || !effectiveBranchId) return;
    cart.addToCart(product, variant, getVariantPrice(variant, effectiveBranchId));
  };

  // Extras (Fase 2, docs/features/mesero-y-mejoras-pos/) se eligen de los
  // productos de catálogo con categoría "otro" (ej. Extra queso, Extra
  // tocino) en vez de tipearlos a mano — reusa el precio ya cargado ahí.
  const extraOptions = effectiveBranchId
    ? products
        .filter((p) => p.category === "otro")
        .flatMap((p) =>
          p.product_variants.map((v) => ({
            name: p.product_variants.length > 1 ? `${p.name} (${v.name})` : p.name,
            price: getVariantPrice(v, effectiveBranchId),
          }))
        )
    : [];

  const handleSubmitOrder = async () => {
    if (!effectiveBranchId || !waiterName || cart.items.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = addingToOrder
      ? await MeseroService.addItemsToOrder(addingToOrder.id, cart.items, cart.total)
      : await MeseroService.createOrder({
          branchId: effectiveBranchId,
          items: cart.items,
          total: cart.total,
          orderType: cart.orderType,
          tableNumber: cart.orderType === "dine_in" ? cart.tableNumber.trim() || null : null,
          waiterName,
          idempotencyKey: generateUUID(),
        });

    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "No se pudo enviar el pedido");
      return;
    }
    cart.clearCart();
    setAddingToOrder(null);
    refreshOrders();
    setTab("mis-pedidos");
  };

  return {
    identity, effectiveBranchId, waiterName,
    products, loadingProducts, useStock, getVariantPrice, getStockQty, extraOptions,
    cart, myOrders, loadingOrders, connected,
    tab, setTab, submitting, submitError, handleProductClick, handleSubmitOrder,
    addingToOrder, startAddItems, cancelAddItems,
  };
}
