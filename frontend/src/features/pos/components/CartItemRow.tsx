"use client";

import { useState } from "react";
import { Typography, Tag, InputNumber } from "antd";
import { PlusOutlined, MinusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { DiscountedItem } from "@/lib/promotions";

const { Text } = Typography;

interface Props {
  item: DiscountedItem;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onEditPrice?: (id: string, newPrice: number) => void;
  showPromoTag?: boolean;
  maxQty?: number | null;
}

export function CartItemRow({ item, onUpdateQty, onRemove, onEditPrice, showPromoTag = true, maxQty }: Props) {
  const t = useTranslations("pos.cartPanel");
  const [editingPrice, setEditingPrice] = useState(false);
  const lineTotal = item.unit_price * item.qty_physical - item.discount_applied;
  const atMax = maxQty !== null && maxQty !== undefined && item.qty_physical >= maxQty;
  // Editar precio: solo en ventas normales, nunca sobre promo/combo o pizza mixta (Fase 3).
  const canEditPrice = !!onEditPrice && !item.promo_id && !item.promo_label && !item.flavors?.length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.flavors?.length ? t("mixedPizza") : item.product_name}
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
          {item.flavors?.length ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {item.variant_name} — {item.flavors.map((f) => f.product_name).join(" / ")}
            </Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>{item.variant_name}</Text>
          )}
          {showPromoTag && item.promo_label && (
            <Tag color="red" style={{ margin: 0, fontSize: 11, lineHeight: "16px" }}>{item.promo_label}</Tag>
          )}
        </div>
      </div>

      {/* Quantity controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => onUpdateQty(item.variant_id, -1)}
          style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <MinusOutlined style={{ fontSize: 10 }} />
        </button>
        <div style={{ textAlign: "center", width: 24 }}>
          <Text strong style={{ fontSize: 14 }}>{item.qty_physical}</Text>
          {item.qty_physical !== item.qty && (
            <Text style={{ fontSize: 11, color: "#16a34a", display: "block", lineHeight: 1 }}>({item.qty})</Text>
          )}
        </div>
        <button
          onClick={() => onUpdateQty(item.variant_id, 1)}
          disabled={atMax}
          style={{
            width: 28, height: 28, borderRadius: "50%", border: "none",
            background: atMax ? "#f3f4f6" : "#ffedd5",
            cursor: atMax ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <PlusOutlined style={{ fontSize: 10, color: atMax ? "#d1d5db" : "#ea580c" }} />
        </button>
      </div>

      {/* Price */}
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 72 }}>
        {item.discount_applied > 0 && (
          <Text delete type="secondary" style={{ fontSize: 11, display: "block", lineHeight: 1.2 }}>
            Bs {(item.unit_price * item.qty_physical).toFixed(2)}
          </Text>
        )}
        {editingPrice ? (
          <InputNumber
            size="small"
            autoFocus
            min={0}
            step={0.5}
            defaultValue={item.unit_price}
            style={{ width: 80 }}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value >= 0) onEditPrice?.(item.variant_id, value);
              setEditingPrice(false);
            }}
            onPressEnter={(e) => {
              const value = Number((e.target as HTMLInputElement).value);
              if (!Number.isNaN(value) && value >= 0) onEditPrice?.(item.variant_id, value);
              setEditingPrice(false);
            }}
          />
        ) : canEditPrice ? (
          <button
            type="button"
            onClick={() => setEditingPrice(true)}
            style={{
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
              background: "#fff7ed", border: "1px dashed #fdba74", borderRadius: 6,
              padding: "3px 8px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ffedd5"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff7ed"; }}
          >
            <Text strong style={{ fontSize: 13, color: "#ea580c" }}>Bs {lineTotal.toFixed(2)}</Text>
            <EditOutlined style={{ fontSize: 12, color: "#ea580c" }} />
          </button>
        ) : (
          <Text strong style={{ fontSize: 13, color: "#ea580c" }}>Bs {lineTotal.toFixed(2)}</Text>
        )}
        {item.price_edited && (
          <Tag color="purple" style={{ margin: 0, marginTop: 2, fontSize: 10, lineHeight: "14px" }}>Editado</Tag>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onRemove(item.variant_id)}
        style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <DeleteOutlined style={{ fontSize: 12, color: "#9ca3af" }} />
      </button>
    </div>
  );
}
