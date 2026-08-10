"use client";

import { Modal, Typography, Empty, message } from "antd";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Promotion, CartItem } from "@/lib/promotions";
import type { Product, Variant } from "../types/pos.types";

const { Text } = Typography;

interface EligibleOption {
  product: Product;
  variant: Variant;
  price: number;
  discountPercent: number;
}

function buildEligibleOptions(
  promo: Promotion,
  products: Product[],
  branchId: string,
  getVariantPrice: (v: Variant, b: string) => number
): EligibleOption[] {
  const byVariantId = new Map<string, EligibleOption>();

  const upsert = (product: Product, variant: Variant, discountPercent: number) => {
    const existing = byVariantId.get(variant.id);
    if (!existing || discountPercent > existing.discountPercent) {
      byVariantId.set(variant.id, { product, variant, price: getVariantPrice(variant, branchId), discountPercent });
    }
  };

  for (const rule of promo.promotion_rules) {
    if (!rule.discount_percent) continue;

    if (rule.variant_id) {
      for (const product of products) {
        const variant = product.product_variants.find((v) => v.id === rule.variant_id && v.is_active !== false);
        if (!variant) continue;
        upsert(product, variant, rule.discount_percent);
        break;
      }
      continue;
    }

    // No variant_id on the rule — applies to every active product in the catalog
    for (const product of products) {
      for (const variant of product.product_variants) {
        if (variant.is_active === false) continue;
        upsert(product, variant, rule.discount_percent);
      }
    }
  }

  return Array.from(byVariantId.values());
}

interface Props {
  promo: Promotion | null;
  products: Product[];
  branchId: string;
  getVariantPrice: (variant: Variant, branchId: string) => number;
  onAddItems: (items: CartItem[]) => void;
  onClose: () => void;
}

export function PromoPercentageModal({ promo, products, branchId, getVariantPrice, onAddItems, onClose }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("pos.percentageModal");

  if (!promo) return null;

  const options = buildEligibleOptions(promo, products, branchId, getVariantPrice);

  const handleAdd = (option: EligibleOption) => {
    onAddItems([{
      variant_id: option.variant.id,
      qty: 1,
      unit_price: option.price,
      product_name: option.product.name,
      variant_name: option.variant.name,
      category: option.product.category,
      promo_id: promo.id,
    }]);
    message.success(t("addedToast", { name: option.product.name, percent: option.discountPercent }));
  };

  return (
    <Modal
      title={<span>{promo.name}</span>}
      open={!!promo}
      onCancel={onClose}
      footer={null}
      width={isMobile ? "100%" : 720}
      style={{ maxWidth: "calc(100vw - 32px)", top: isMobile ? 16 : 24 }}
      destroyOnHidden
    >
      {options.length === 0 ? (
        <Empty description={t("noEligible")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, maxHeight: 480, overflowY: "auto", paddingTop: 4 }}>
          {options.map((option) => {
            const discountedPrice = option.price * (1 - option.discountPercent / 100);
            return (
              <button
                key={option.variant.id}
                onClick={() => handleAdd(option)}
                style={{
                  border: "2px solid #bae6fd",
                  borderRadius: 10,
                  padding: "10px 8px",
                  background: "#f0f9ff",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0369a1", lineHeight: 1.3 }}>{option.product.name}</div>
                {option.variant.name !== option.product.name && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{option.variant.name}</div>
                )}
                <div style={{ marginTop: 4 }}>
                  <Text delete style={{ fontSize: 11, color: "#9ca3af" }}>Bs {option.price.toFixed(2)}</Text>
                  <Text strong style={{ fontSize: 13, color: "#0369a1", marginLeft: 6 }}>Bs {discountedPrice.toFixed(2)}</Text>
                </div>
                <div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, marginTop: 2 }}>{option.discountPercent}% OFF</div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
