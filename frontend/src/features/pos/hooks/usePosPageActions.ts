"use client";

import { useState } from "react";
import { message } from "antd";
import { generateUUID } from "@/lib/uuid";
import { PosService } from "../services/pos.service";
import type { usePosCart } from "./usePosCart";
import type { usePaymentValidation } from "./usePaymentValidation";
import type { Product, TicketData, OrderType, Variant, PosTab, PaymentMethod, SplitPayment, DayOrder } from "../types/pos.types";
import type { CartItem, DiscountedItem, FlavorItem } from "@/lib/promotions";

interface Params {
  branchId: string;
  isMobile: boolean;
  products: Product[];
  getVariantPrice: (variant: Variant, branchId: string) => number;
  cart: ReturnType<typeof usePosCart>;
  broadcast: (event: string) => void;
  fetchDayOrders: (branchId: string) => void;
  refreshProducts: () => void;
  paymentValidation: ReturnType<typeof usePaymentValidation>;
  setActiveTab: (tab: PosTab) => void;
}

export function usePosPageActions({
  branchId, isMobile, products, getVariantPrice, cart,
  broadcast, fetchDayOrders, refreshProducts, paymentValidation, setActiveTab,
}: Params) {
  const [variantModal, setVariantModal] = useState<Product | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null);
  const [payments, setPayments] = useState<SplitPayment[] | null>(null);
  const [saleNotes, setSaleNotes] = useState<string | null>(null);
  const [saleTableNumber, setSaleTableNumber] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"catalog" | "cart">("catalog");

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

  const handlePromoSingleVariant = (variantId: string, qty: number) => {
    for (const p of products) {
      const v = p.product_variants.find((pv) => pv.id === variantId);
      if (v) {
        for (let i = 0; i < qty; i++) cart.addToCart(p, v, getVariantPrice(v, branchId));
        if (isMobile) { setActiveTab("sale"); setMobileView("cart"); }
        return;
      }
    }
  };

  const handlePaymentConfirm = (
    orderType: OrderType,
    method: PaymentMethod,
    provider: string | null,
    splitPayments: SplitPayment[] | null,
    notes: string | null,
    tableNumber: string | null,
  ) => {
    setPaymentMethod(method);
    setPaymentProvider(provider);
    setPayments(splitPayments);
    setSaleNotes(notes);
    setSaleTableNumber(tableNumber);
    cart.setOrderType(orderType);
    setIdempotencyKey(generateUUID());
    setPaymentModal(false);
    setConfirmModal(true);
  };

  const handleConfirmSale = async () => {
    if (!branchId) {
      message.error("No hay sucursal seleccionada.");
      return;
    }
    if (!cart.orderType) {
      message.error("Seleccioná el tipo de pedido antes de confirmar.");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setConfirmLoading(true);
    try {
      const result = await PosService.confirmSale(branchId, cart.discountedCart, cart.total, paymentMethod, paymentProvider, cart.orderType, controller.signal, idempotencyKey ?? undefined, payments ?? undefined, saleNotes, saleTableNumber);

      if (result.ok) {
        broadcast("ORDER_COMPLETE");
        cart.suppressNextClear();
        setConfirmModal(false);
        setPaymentMethod(null);
        setPaymentProvider(null);
        setPayments(null);
        setIdempotencyKey(null);
        setActiveTab("sale");
        setTicket({ orderId: result.order_id!, dailyNumber: result.daily_number!, items: cart.discountedCart, total: cart.total, paymentMethod, paymentProvider, payments, orderType: cart.orderType, notes: saleNotes, tableNumber: saleTableNumber });
        setSaleNotes(null);
        setSaleTableNumber(null);
        cart.clearCart();
        fetchDayOrders(branchId);
        refreshProducts();
      } else {
        message.error(`Error al confirmar venta: ${result.error}`, 5);
      }
    } finally {
      clearTimeout(timeout);
      setConfirmLoading(false);
    }
  };

  const handleValidatePayment = () => {
    setValidationModalOpen(true);
    paymentValidation.start(cart.total);
  };

  const handleValidationConfirm = () => {
    paymentValidation.cancel();
    setValidationModalOpen(false);
    handleConfirmSale();
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
    setTicket({
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
    variantModal, setVariantModal,
    paymentModal, setPaymentModal,
    confirmModal, setConfirmModal,
    paymentMethod, setPaymentMethod,
    paymentProvider, setPaymentProvider,
    payments,
    ticket, setTicket,
    confirmLoading,
    validationModalOpen,
    mobileView, setMobileView,
    handleProductClick, handleVariantSelect, handlePromoItems, handlePromoSingleVariant,
    handlePaymentConfirm, handleConfirmSale,
    handleValidatePayment, handleValidationConfirm, handleValidationCancel,
    handlePrintDayOrder,
  };
}
