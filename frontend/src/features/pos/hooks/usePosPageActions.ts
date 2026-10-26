"use client";

import { useState } from "react";
import { useConfirmSale } from "./useConfirmSale";
import type { useOfflineSales } from "./useOfflineSales";
import type { usePosCart } from "./usePosCart";
import type { usePaymentValidation } from "./usePaymentValidation";
import type { Product, Variant, PosTab, DayOrder } from "../types/pos.types";
import type { CartItem, DiscountedItem, FlavorItem } from "@/lib/promotions";

interface Params {
  branchId: string;
  isMobile: boolean;
  products: Product[];
  getVariantPrice: (variant: Variant, branchId: string) => number;
  cart: ReturnType<typeof usePosCart>;
  broadcast: (event: string) => void;
  applyStockUpdates: (updates: { variant_id: string; quantity: number }[]) => void;
  decrementLocalStock: (sold: { variant_id: string; qty_physical: number }[]) => void;
  offlineSales: ReturnType<typeof useOfflineSales>;
  offlineEnabled: boolean;
  paymentValidation: ReturnType<typeof usePaymentValidation>;
  setActiveTab: (tab: PosTab) => void;
}

export function usePosPageActions({
  branchId, isMobile, products, getVariantPrice, cart,
  broadcast, applyStockUpdates, decrementLocalStock, paymentValidation, setActiveTab,
  offlineSales, offlineEnabled,
}: Params) {
  const [variantModal, setVariantModal] = useState<Product | null>(null);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"catalog" | "cart">("catalog");

  // Closing a sale (payment selection + online/queued submit) lives in its own
  // hook; this one stays about the catalog and the modals around it.
  const sale = useConfirmSale({
    branchId, cart, broadcast, applyStockUpdates, decrementLocalStock,
    offlineSales, offlineEnabled, setActiveTab,
  });

  const handleProductClick = (product: Product) => {
    const variants = product.product_variants ?? [];
    if (variants.length === 1) {
      cart.addToCart(product, variants[0], getVariantPrice(variants[0], branchId));
      if (isMobile) setMobileView("cart");
    } else {
      setVariantModal(product);
    }
  };

  const handleVariantSelect = (product: Product, variant: Variant, flavors?: FlavorItem[]) => {
    cart.addToCart(product, variant, getVariantPrice(variant, branchId), flavors);
    setVariantModal(null);
    if (isMobile) setMobileView("cart");
  };

  const handlePromoItems = (items: CartItem[]) => {
    cart.addItemsToCart(items);
    if (isMobile) { setActiveTab("sale"); setMobileView("cart"); }
  };

  const handlePromoSingleVariant = (variantId: string, qty: number, promoId: string) => {
    for (const p of products) {
      const v = p.product_variants.find((pv) => pv.id === variantId);
      if (v) {
        for (let i = 0; i < qty; i++) cart.addToCart(p, v, getVariantPrice(v, branchId), undefined, promoId);
        if (isMobile) { setActiveTab("sale"); setMobileView("cart"); }
        return;
      }
    }
  };

  const handleValidatePayment = () => {
    setValidationModalOpen(true);
    paymentValidation.start(cart.total);
  };

  const handleValidationConfirm = () => {
    paymentValidation.cancel();
    setValidationModalOpen(false);
    sale.handleConfirmSale();
  };

  const handleValidationCancel = () => {
    paymentValidation.cancel();
    setValidationModalOpen(false);
  };

  // Fase 5 (docs/features/mesero-y-mejoras-pos/) — "Imprimir" desde Pedidos
  // del día: la orden ya existe (creada por mesero o por POS), solo arma el
  // TicketData a partir de lo que ya trae el DayOrder.
  const handlePrintDayOrder = (order: DayOrder) => {
    const items: DiscountedItem[] = order.order_items.map((i, idx) => ({
      variant_id: String(idx),
      qty: i.qty,
      qty_physical: i.qty_physical,
      unit_price: i.unit_price,
      product_name: i.product_variants?.products?.name ?? "",
      variant_name: i.product_variants?.name ?? "",
      category: "",
      discount_applied: i.discount_applied,
      final_price: i.unit_price,
      promo_label: i.promo_label,
    }));
    sale.setTicket({
      orderId: order.id,
      dailyNumber: order.daily_number,
      items,
      total: Number(order.total),
      paymentMethod: order.payment_method,
      paymentProvider: order.payment_provider,
      payments: order.payments,
      orderType: order.order_type,
      tableNumber: order.table_number,
      waiterName: order.waiter_name,
      notes: order.notes,
    });
  };

  return {
    // Spread first so the sale hook's own members stay authoritative.
    ...sale,
    variantModal, setVariantModal,
    validationModalOpen,
    mobileView, setMobileView,
    handleProductClick, handleVariantSelect, handlePromoItems, handlePromoSingleVariant,
    handleValidatePayment, handleValidationConfirm, handleValidationCancel,
    handlePrintDayOrder,
  };
}
