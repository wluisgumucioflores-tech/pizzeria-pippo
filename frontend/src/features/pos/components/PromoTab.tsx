"use client";

import { useState } from "react";
import { Tag, Typography, Empty } from "antd";
import { GiftOutlined, PercentageOutlined, SwapOutlined, RightOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Promotion } from "@/lib/promotions";
import type { Product, Variant } from "../types/pos.types";
import type { CartItem } from "@/lib/promotions";
import { PromoComboModal } from "./PromoComboModal";
import { PromoPercentageModal } from "./PromoPercentageModal";

const { Text } = Typography;

type PosTranslator = ReturnType<typeof useTranslations>;

interface Props {
  promotions: Promotion[];
  products: Product[];
  branchId: string;
  getVariantPrice: (variant: Variant, branchId: string) => number;
  onAddItems: (items: CartItem[]) => void;
  onAddSingleVariant: (variantId: string, qty: number) => void;
}

function buyXGetYDescription(promo: Promotion, products: Product[], t: PosTranslator): string {
  const lines: string[] = [];
  for (const rule of promo.promotion_rules) {
    if (!rule.variant_id || !rule.buy_qty || !rule.get_qty) continue;
    let name = rule.variant_id;
    for (const p of products) {
      const v = p.product_variants.find((pv) => pv.id === rule.variant_id);
      if (v) { name = `${p.name} ${v.name}`; break; }
    }
    lines.push(t("promoDesc.buyXGetY", { buy: rule.buy_qty, total: rule.buy_qty + rule.get_qty, name }));
  }
  return lines.join(" · ") || promo.name;
}

function percentageDescription(promo: Promotion, products: Product[], t: PosTranslator): string {
  const lines: string[] = [];
  for (const rule of promo.promotion_rules) {
    if (!rule.discount_percent) continue;
    if (!rule.variant_id) {
      lines.push(t("promoDesc.percentageAll", { percent: rule.discount_percent }));
    } else {
      let name = rule.variant_id;
      for (const p of products) {
        const v = p.product_variants.find((pv) => pv.id === rule.variant_id);
        if (v) { name = `${p.name} ${v.name}`; break; }
      }
      lines.push(t("promoDesc.percentageSpecific", { percent: rule.discount_percent, name }));
    }
  }
  return lines.join(" · ") || promo.name;
}

function comboDescription(promo: Promotion, t: PosTranslator): string {
  const comboPrice = promo.promotion_rules[0]?.combo_price;
  const count = promo.promotion_rules.length;
  return t("promoDesc.combo", { count, price: comboPrice?.toFixed(2) ?? "—" });
}

export function PromoTab({ promotions, products, branchId, getVariantPrice, onAddItems, onAddSingleVariant }: Props) {
  const [comboPromo, setComboPromo] = useState<Promotion | null>(null);
  const [percentagePromo, setPercentagePromo] = useState<Promotion | null>(null);
  const t = useTranslations("pos");
  const TYPE_CONFIG = {
    BUY_X_GET_Y: { icon: <SwapOutlined />, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", label: t("promoType.buyXGetY") },
    PERCENTAGE: { icon: <PercentageOutlined />, color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", label: t("promoType.percentage") },
    COMBO: { icon: <GiftOutlined />, color: "#b45309", bg: "#fff7ed", border: "#fed7aa", label: t("promoType.combo") },
  };

  const handlePromoClick = (promo: Promotion) => {
    if (promo.type === "COMBO") {
      setComboPromo(promo);
      return;
    }
    if (promo.type === "BUY_X_GET_Y") {
      // Add buy_qty units of each variant — engine applies the get_qty discount automatically
      for (const rule of promo.promotion_rules) {
        if (rule.variant_id && rule.buy_qty) {
          onAddSingleVariant(rule.variant_id, rule.buy_qty);
        }
      }
      return;
    }
    if (promo.type === "PERCENTAGE") {
      setPercentagePromo(promo);
    }
  };

  if (promotions.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
        <Empty description={t("promos.empty")} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16, background: "#f5f5f5" }}>
      <Text strong style={{ fontSize: 15, color: "#374151", display: "block", marginBottom: 12 }}>
        {t("promos.title", { count: promotions.length })}
      </Text>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {promotions.map((promo) => {
          const config = TYPE_CONFIG[promo.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.PERCENTAGE;
          const isCombo = promo.type === "COMBO";

          let description = "";
          if (promo.type === "BUY_X_GET_Y") description = buyXGetYDescription(promo, products, t);
          else if (promo.type === "PERCENTAGE") description = percentageDescription(promo, products, t);
          else if (promo.type === "COMBO") description = comboDescription(promo, t);

          return (
            <div
              key={promo.id}
              onClick={() => handlePromoClick(promo)}
              style={{
                borderRadius: 12,
                border: `1.5px solid ${config.border}`,
                background: config.bg,
                padding: "12px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "box-shadow 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
            >
              {/* Icon */}
              <div style={{ width: 40, height: 40, borderRadius: 10, background: config.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, flexShrink: 0 }}>
                {config.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Text strong style={{ fontSize: 14, color: "#111827" }}>{promo.name}</Text>
                  <Tag color={config.color} style={{ margin: 0, fontSize: 10, border: "none" }}>{config.label}</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>
              </div>

              {/* Arrow / action hint */}
              <div style={{ color: config.color, flexShrink: 0 }}>
                {isCombo
                  ? <RightOutlined style={{ fontSize: 14 }} />
                  : <Text style={{ fontSize: 12, color: config.color, fontWeight: 600 }}>{t("promos.add")}</Text>
                }
              </div>
            </div>
          );
        })}
      </div>

      <PromoComboModal
        promo={comboPromo}
        products={products}
        branchId={branchId}
        getVariantPrice={getVariantPrice}
        onConfirm={onAddItems}
        onClose={() => setComboPromo(null)}
      />

      <PromoPercentageModal
        promo={percentagePromo}
        products={products}
        branchId={branchId}
        getVariantPrice={getVariantPrice}
        onAddItems={onAddItems}
        onClose={() => setPercentagePromo(null)}
      />
    </div>
  );
}
