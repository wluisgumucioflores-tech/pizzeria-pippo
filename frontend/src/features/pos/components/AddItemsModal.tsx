"use client";

import { useState } from "react";
import { Modal, Button, Typography, message } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { usePosCart } from "../hooks/usePosCart";
import { ProductCatalog } from "./ProductCatalog";
import { VariantSelectorModal } from "./VariantSelectorModal";
import { PosCartItemsList } from "./PosCartItemsList";
import { PosService } from "../services/pos.service";
import type { Product, Variant, DayOrder } from "../types/pos.types";
import type { Promotion, FlavorItem } from "@/lib/promotions";

const { Text } = Typography;

// Carrito propio, aislado del carrito principal de la venta en curso — este
// modal reusa usePosCart (mismas reglas de promos/stock) pero con un
// broadcast vacío para no pisar la pantalla del cliente con estos items.
const noopBroadcast = () => {};

interface Props {
  order: DayOrder | null;
  branchId: string;
  products: Product[];
  promotions: Promotion[];
  useStock: boolean;
  getVariantPrice: (variant: Variant, branchId: string) => number;
  getPromoLabel: (variantId: string) => string | null;
  getStockQty: (variantId: string) => number | null;
  onClose: () => void;
  onSubmitted: (orderId: string, reopened: boolean) => void;
}

export function AddItemsModal({
  order, branchId, products, promotions, useStock,
  getVariantPrice, getPromoLabel, getStockQty, onClose, onSubmitted,
}: Props) {
  const ta = useTranslations("pos.addItemsModal");
  const cart = usePosCart(promotions, branchId, noopBroadcast, useStock ? getStockQty : undefined);
  const [variantModal, setVariantModal] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleProductClick = (product: Product) => {
    const variants = product.product_variants ?? [];
    if (variants.length === 1) {
      cart.addToCart(product, variants[0], getVariantPrice(variants[0], branchId));
    } else {
      setVariantModal(product);
    }
  };

  const handleVariantSelect = (product: Product, variant: Variant, flavors?: FlavorItem[]) => {
    cart.addToCart(product, variant, getVariantPrice(variant, branchId), flavors);
    setVariantModal(null);
  };

  const handleClose = () => {
    cart.clearCart();
    onClose();
  };

  const handleSubmit = async () => {
    if (!order || cart.discountedCart.length === 0) return;
    setSubmitting(true);
    const result = await PosService.addItemsToOrder(order.id, cart.discountedCart, cart.total);
    setSubmitting(false);
    if (!result.ok) {
      message.error(result.error ?? ta("error"));
      return;
    }
    const reopened = order.kitchen_status === "ready";
    cart.clearCart();
    onSubmitted(order.id, reopened);
  };

  if (!order) return null;

  return (
    <Modal
      title={ta("title", { number: String(order.daily_number).padStart(2, "0") })}
      open={!!order}
      onCancel={handleClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      {order.kitchen_status === "ready" && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-300 text-sm text-yellow-800">
          {ta("reopenHint")}
        </div>
      )}
      <div style={{ display: "flex", gap: 16, height: "65vh" }}>
        <div style={{ flex: 1, minWidth: 0, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <ProductCatalog
            products={products}
            loading={false}
            branchId={branchId}
            useStock={useStock}
            getVariantPrice={getVariantPrice}
            getPromoLabel={getPromoLabel}
            onProductClick={handleProductClick}
          />
        </div>
        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
            <PosCartItemsList
              discountedCart={cart.discountedCart}
              onUpdateQty={cart.updateQty}
              onRemove={cart.removeFromCart}
              onEditPrice={cart.updatePrice}
              getStockQty={cart.getStockQty}
            />
          </div>
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 8 }}>
            <div className="flex justify-between items-baseline mb-3">
              <Text style={{ color: "#6b7280" }}>{ta("total")}</Text>
              <Text strong style={{ fontSize: 24, color: "#ea580c" }}>Bs {cart.total.toFixed(2)}</Text>
            </div>
            <Button
              type="primary"
              size="large"
              block
              icon={<CheckOutlined />}
              disabled={cart.discountedCart.length === 0}
              loading={submitting}
              onClick={handleSubmit}
              style={{ background: "#ea580c", borderColor: "#ea580c", height: 48 }}
            >
              {ta("confirm")}
            </Button>
          </div>
        </div>
      </div>

      <VariantSelectorModal
        product={variantModal}
        branchId={branchId}
        allProducts={products}
        getVariantPrice={getVariantPrice}
        getPromoLabel={getPromoLabel}
        onSelect={handleVariantSelect}
        onClose={() => setVariantModal(null)}
      />
    </Modal>
  );
}
