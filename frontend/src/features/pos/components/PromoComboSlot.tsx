"use client";

import { Typography, Tag } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { PromotionRule } from "@/lib/promotions";
import type { Product, Variant } from "../types/pos.types";
import type { SlotSelection, FlavorEntry } from "../types/promo-combo.types";
import { PromoComboFlavorBuilder } from "./PromoComboFlavorBuilder";

const { Text } = Typography;

function buildSlotLabel(rule: PromotionRule, products: Product[], t: ReturnType<typeof useTranslations>): string {
  if (rule.variant_id) {
    for (const p of products) {
      const v = p.product_variants.find((pv) => pv.id === rule.variant_id);
      if (v) return `${p.name} — ${v.name}`;
    }
    return t("comboSlot.specificProduct");
  }
  const parts = [rule.category, rule.variant_size].filter(Boolean);
  return parts.length ? parts.join(" ") : t("comboSlot.anyProduct");
}

function getSlotOptions(rule: PromotionRule, products: Product[], branchId: string, getVariantPrice: (v: Variant, b: string) => number) {
  if (rule.variant_id) {
    for (const p of products) {
      const v = p.product_variants.find((pv) => pv.id === rule.variant_id && pv.is_active !== false);
      if (v) return [{ product: p, variant: v, price: getVariantPrice(v, branchId) }];
    }
    return [];
  }
  const results: { product: Product; variant: Variant; price: number }[] = [];
  for (const p of products) {
    if (rule.category && p.category !== rule.category) continue;
    for (const v of p.product_variants) {
      if (v.is_active === false) continue;
      if (rule.variant_size && v.name !== rule.variant_size) continue;
      results.push({ product: p, variant: v, price: getVariantPrice(v, branchId) });
    }
  }
  return results;
}

interface Props {
  rule: PromotionRule;
  idx: number;
  products: Product[];
  branchId: string;
  getVariantPrice: (variant: Variant, branchId: string) => number;
  selected: SlotSelection | null;
  showFlavorBuilder: boolean;
  onSelect: (idx: number, product: Product, variant: Variant) => void;
  onRevealFlavorBuilder: (idx: number) => void;
  onFlavorChange: (idx: number, entries: FlavorEntry[]) => void;
}

export function PromoComboSlot({
  rule, idx, products, branchId, getVariantPrice,
  selected, showFlavorBuilder, onSelect, onRevealFlavorBuilder, onFlavorChange,
}: Props) {
  const t = useTranslations("pos");
  const options = getSlotOptions(rule, products, branchId, getVariantPrice);
  const isFixed = !!rule.variant_id;
  const label = buildSlotLabel(rule, products, t);
  const isPizzaSlot = rule.category === "pizza" || (!rule.category && selected?.category === "pizza");
  const selectedProduct = selected ? products.find((p) => p.product_variants.some((v) => v.id === selected.variantId)) : null;
  const selectedVariant = selectedProduct?.product_variants.find((v) => v.id === selected?.variantId);

  return (
    <div style={{ border: `2px solid ${selected ? "#fed7aa" : "#e5e7eb"}`, borderRadius: 10, overflow: "hidden", transition: "border-color 0.2s" }}>
      {/* Slot header */}
      <div style={{ padding: "8px 12px", background: selected ? "#fff7ed" : "#f9fafb", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: selected ? "#ea580c" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {selected
            ? <CheckOutlined style={{ fontSize: 11, color: "#fff" }} />
            : <Text style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>{idx + 1}</Text>
          }
        </div>
        <Text strong style={{ fontSize: 13, color: selected ? "#c2410c" : "#374151" }}>{label}</Text>
        {isFixed && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{t("comboSlot.fixed")}</Tag>}
      </div>

      {/* Selected summary (fixed slots) */}
      {isFixed && selected && (
        <div style={{ padding: "8px 12px" }}>
          <Text style={{ fontSize: 12, color: "#ea580c", fontWeight: 600 }}>
            {selected.productName}{selected.variantName !== selected.productName ? ` — ${selected.variantName}` : ""}
          </Text>
        </div>
      )}

      {/* Slot options (flexible slots) */}
      {!isFixed && (
        <div style={{ padding: "10px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6 }}>
            {options.map(({ product, variant, price }) => {
              const isSel = selected?.variantId === variant.id;
              return (
                <button
                  key={variant.id}
                  onClick={() => onSelect(idx, product, variant)}
                  style={{
                    border: `2px solid ${isSel ? "#ea580c" : "#e5e7eb"}`,
                    borderRadius: 8,
                    padding: "8px 6px",
                    background: isSel ? "#fff7ed" : "#fff",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? "#ea580c" : "#374151", lineHeight: 1.3 }}>{product.name}</div>
                  {variant.name !== product.name && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{variant.name}</div>
                  )}
                  <div style={{ fontSize: 12, color: isSel ? "#ea580c" : "#9ca3af", fontWeight: 600, marginTop: 2 }}>Bs {price}</div>
                </button>
              );
            })}
          </div>

          {isPizzaSlot && selected && selectedProduct && selectedVariant && (
            <div style={{ marginTop: 8 }}>
              {!showFlavorBuilder ? (
                <button
                  onClick={() => onRevealFlavorBuilder(idx)}
                  style={{ fontSize: 12, color: "#ea580c", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  {t("comboSlot.addMixedPizza")}
                </button>
              ) : (
                <PromoComboFlavorBuilder
                  selectedVariant={selectedVariant}
                  product={selectedProduct}
                  products={products}
                  onChange={(entries) => onFlavorChange(idx, entries)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
