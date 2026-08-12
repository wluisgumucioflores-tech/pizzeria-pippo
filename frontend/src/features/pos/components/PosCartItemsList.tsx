"use client";

import { Typography } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { CartItemRow } from "./CartItemRow";
import type { DiscountedItem } from "@/lib/promotions";

const { Text } = Typography;

type CartGroup =
  | { type: "item"; item: DiscountedItem }
  | { type: "combo"; name: string; items: DiscountedItem[] };

function buildGroups(discountedCart: DiscountedItem[]): CartGroup[] {
  const groups: CartGroup[] = [];
  const comboMap = new Map<string, DiscountedItem[]>();

  for (const item of discountedCart) {
    const comboMatch = item.promo_label?.match(/^Combo — (.+)$/);
    if (comboMatch) {
      const comboName = comboMatch[1];
      if (!comboMap.has(comboName)) comboMap.set(comboName, []);
      comboMap.get(comboName)!.push(item);
    } else {
      groups.push({ type: "item", item });
    }
  }
  // Combos go after individual items
  for (const [name, items] of Array.from(comboMap)) {
    groups.push({ type: "combo", name, items });
  }
  return groups;
}

interface Props {
  discountedCart: DiscountedItem[];
  onUpdateQty: (variantId: string, delta: number) => void;
  onRemove: (variantId: string) => void;
  onEditPrice: (variantId: string, newPrice: number) => void;
  getStockQty: (variantId: string) => number | null;
}

export function PosCartItemsList({ discountedCart, onUpdateQty, onRemove, onEditPrice, getStockQty }: Props) {
  const t = useTranslations("pos.cartPanel");
  const groups = buildGroups(discountedCart);

  if (discountedCart.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>
        <ShoppingCartOutlined style={{ fontSize: 48, opacity: 0.25, marginBottom: 12 }} />
        <Text type="secondary">{t("emptyState")}</Text>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {groups.map((group, idx) => {
        if (group.type === "item") {
          return (
            <div key={`item-${idx}-${group.item.variant_id}`} style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
              <CartItemRow item={group.item} onUpdateQty={onUpdateQty} onRemove={onRemove} onEditPrice={onEditPrice} maxQty={getStockQty(group.item.variant_id)} />
            </div>
          );
        }
        const comboDiscount = group.items.reduce((sum, i) => sum + i.discount_applied, 0);
        return (
          <div key={`combo-${idx}`} style={{ borderRadius: 10, border: "2px solid #fed7aa", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#fff7ed" }}>
              <Text strong style={{ fontSize: 12, color: "#c2410c" }}>🍕 {group.name}</Text>
              <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>- Bs {comboDiscount.toFixed(2)}</Text>
            </div>
            {group.items.map((item, i) => (
              <div key={item.variant_id} style={{ padding: "10px 12px", background: "rgba(255,247,237,0.4)", borderTop: i > 0 ? "1px solid #fed7aa" : undefined }}>
                <CartItemRow item={item} onUpdateQty={onUpdateQty} onRemove={onRemove} showPromoTag={false} maxQty={getStockQty(item.variant_id)} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
