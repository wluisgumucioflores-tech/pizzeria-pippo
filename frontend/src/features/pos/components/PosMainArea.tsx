"use client";

import { useTranslations } from "next-intl";
import { ProductCatalog } from "./ProductCatalog";
import { PromoTab } from "./PromoTab";
import { PosCart } from "./PosCart";
import type { usePosCart } from "../hooks/usePosCart";
import type { Product, Variant, PosTab } from "../types/pos.types";
import type { Promotion, CartItem } from "@/lib/promotions";

interface Props {
  activeTab: PosTab;
  isMobile: boolean;
  mobileView: "catalog" | "cart";
  onMobileViewChange: (view: "catalog" | "cart") => void;
  products: Product[];
  loading: boolean;
  branchId: string;
  getVariantPrice: (variant: Variant, branchId: string) => number;
  getPromoLabel: (variantId: string) => string | null;
  onProductClick: (product: Product) => void;
  cart: ReturnType<typeof usePosCart>;
  onOpenPayment: () => void;
  activePromotions: Promotion[];
  onAddItems: (items: CartItem[]) => void;
  onAddSingleVariant: (variantId: string, qty: number) => void;
}

export function PosMainArea({
  activeTab, isMobile, mobileView, onMobileViewChange,
  products, loading, branchId, getVariantPrice, getPromoLabel, onProductClick,
  cart, onOpenPayment, activePromotions, onAddItems, onAddSingleVariant,
}: Props) {
  const t = useTranslations("pos.mobileNav");
  const cartItemCount = cart.discountedCart.reduce((s, i) => s + i.qty_physical, 0);
  const cartPanel = (
    <PosCart
      discountedCart={cart.discountedCart}
      total={cart.total}
      totalDiscount={cart.totalDiscount}
      onUpdateQty={cart.updateQty}
      onRemove={cart.removeFromCart}
      onEditPrice={cart.updatePrice}
      onConfirm={onOpenPayment}
      onClear={cart.clearCart}
      getStockQty={cart.getStockQty}
    />
  );
  if (activeTab === "sale" && !isMobile) {
    return (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <ProductCatalog products={products} loading={loading} branchId={branchId} getVariantPrice={getVariantPrice} getPromoLabel={getPromoLabel} onProductClick={onProductClick} />
        {cartPanel}
      </div>
    );
  }

  if (activeTab === "promos" && !isMobile) {
    return (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <PromoTab promotions={activePromotions} products={products} branchId={branchId} getVariantPrice={getVariantPrice} onAddItems={onAddItems} onAddSingleVariant={onAddSingleVariant} />
        {cartPanel}
      </div>
    );
  }

  if (activeTab === "sale" && isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden", display: mobileView === "catalog" ? "flex" : "none", flexDirection: "column" }}>
          <ProductCatalog products={products} loading={loading} branchId={branchId} getVariantPrice={getVariantPrice} getPromoLabel={getPromoLabel} onProductClick={onProductClick} />
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: mobileView === "cart" ? "flex" : "none", flexDirection: "column" }}>
          {cartPanel}
        </div>
        <div style={{ display: "flex", borderTop: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
          <button onClick={() => onMobileViewChange("catalog")} style={{ flex: 1, padding: "12px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: mobileView === "catalog" ? "#fff7ed" : "#fff", color: mobileView === "catalog" ? "#ea580c" : "#6b7280", borderTop: mobileView === "catalog" ? "2px solid #ea580c" : "2px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {t("catalog")}
          </button>
          <button onClick={() => onMobileViewChange("cart")} style={{ flex: 1, padding: "12px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: mobileView === "cart" ? "#fff7ed" : "#fff", color: mobileView === "cart" ? "#ea580c" : "#6b7280", borderTop: mobileView === "cart" ? "2px solid #ea580c" : "2px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {t("cart")}
            {cartItemCount > 0 && (
              <span style={{ background: "#ea580c", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (activeTab === "promos" && isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <PromoTab promotions={activePromotions} products={products} branchId={branchId} getVariantPrice={getVariantPrice} onAddItems={onAddItems} onAddSingleVariant={onAddSingleVariant} />
      </div>
    );
  }

  return null;
}
