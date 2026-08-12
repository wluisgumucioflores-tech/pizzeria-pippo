"use client";

import { ShoppingCartOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { DiscountedItem } from "@/lib/promotions";
import { useIsMobile } from "@/lib/useIsMobile";
import { PosCartItemsList } from "./PosCartItemsList";
import { PosCartFooter } from "./PosCartFooter";

interface Props {
  discountedCart: DiscountedItem[];
  total: number;
  totalDiscount: number;
  onUpdateQty: (variantId: string, delta: number) => void;
  onRemove: (variantId: string) => void;
  onEditPrice: (variantId: string, newPrice: number) => void;
  onConfirm: () => void;
  onClear: () => void;
  getStockQty: (variantId: string) => number | null;
}

export function PosCart({ discountedCart, total, totalDiscount, onUpdateQty, onRemove, onEditPrice, onConfirm, onClear, getStockQty }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("pos.cartPanel");

  return (
    <div style={{ width: isMobile ? "100%" : 380, minWidth: isMobile ? 0 : 380, background: "#fff", borderLeft: isMobile ? "none" : "1px solid #e5e7eb", display: "flex", flexDirection: "column", boxShadow: isMobile ? "none" : "-4px 0 16px rgba(0,0,0,0.06)", flex: isMobile ? 1 : undefined }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8, background: "#ea580c" }}>
        <ShoppingCartOutlined style={{ color: "#fff", fontSize: 18 }} />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{t("title")}</span>
        {discountedCart.length > 0 && (
          <span style={{ marginLeft: "auto", background: "#fff", color: "#ea580c", fontSize: 12, fontWeight: 700, borderRadius: 12, padding: "1px 8px" }}>
            {discountedCart.reduce((s, i) => s + i.qty_physical, 0)}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        <PosCartItemsList discountedCart={discountedCart} onUpdateQty={onUpdateQty} onRemove={onRemove} onEditPrice={onEditPrice} getStockQty={getStockQty} />
      </div>

      <PosCartFooter total={total} totalDiscount={totalDiscount} isEmpty={discountedCart.length === 0} onConfirm={onConfirm} onClear={onClear} />
    </div>
  );
}
