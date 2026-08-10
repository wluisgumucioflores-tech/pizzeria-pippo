"use client";

import { useTranslations } from "next-intl";
import type { DisplayCartItem } from "../types/display.types";

interface Props {
  cartItems: DisplayCartItem[];
  cartTotal: number;
}

export function DisplayCart({ cartItems, cartTotal }: Props) {
  const t = useTranslations("display");
  const totalSaved = cartItems.reduce((sum, i) => sum + i.discount_applied, 0);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* Items list */}
      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20, marginTop: 0 }}>
          {t("orderDetail")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cartItems.map((item, i) => (
            <div
              key={`${item.variant_id}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#1f2937",
                borderRadius: 14,
                padding: "16px 24px",
                opacity: 0,
                animation: `fadeSlideIn 0.3s ease forwards`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#fb923c", width: 48, textAlign: "center", flexShrink: 0 }}>
                  {item.qty_physical ?? item.qty}x
                </span>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{item.product_name}</p>
                  <p style={{ fontSize: 14, color: "#9ca3af", margin: "2px 0 0" }}>
                    {item.flavors?.length
                      ? t("halfAndHalf", { first: item.flavors[0].product_name, second: item.flavors[1].product_name })
                      : item.variant_name}
                  </p>
                  {item.promo_label && (
                    <span style={{ display: "inline-block", background: "#dc2626", color: "#fff", fontSize: 12, padding: "2px 10px", borderRadius: 999, marginTop: 4 }}>
                      {item.promo_label}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {item.discount_applied > 0 && (
                  <p style={{ color: "#6b7280", textDecoration: "line-through", fontSize: 13, margin: "0 0 2px" }}>
                    Bs {(item.unit_price * (item.qty_physical ?? item.qty)).toFixed(2)}
                  </p>
                )}
                <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
                  Bs {(item.unit_price * (item.qty_physical ?? item.qty) - item.discount_applied).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total panel */}
      <div style={{ width: 300, background: "#111827", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", borderLeft: "1px solid #1f2937", flexShrink: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12, marginTop: 0 }}>
          {t("totalToPay")}
        </p>
        <p style={{ fontSize: 60, fontWeight: 800, color: "#fb923c", margin: "0 0 8px", lineHeight: 1 }}>
          Bs {cartTotal.toFixed(2)}
        </p>
        {totalSaved > 0 && (
          <div style={{ marginTop: 16, background: "#14532d", borderRadius: 10, padding: "10px 20px", textAlign: "center" }}>
            <p style={{ color: "#86efac", fontSize: 13, margin: "0 0 4px" }}>{t("youSave")}</p>
            <p style={{ color: "#4ade80", fontWeight: 700, fontSize: 20, margin: 0 }}>
              Bs {totalSaved.toFixed(2)}
            </p>
          </div>
        )}
        {cartItems.length > 0 && (
          <div style={{ marginTop: 24, fontSize: 40 }}>🛒</div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
