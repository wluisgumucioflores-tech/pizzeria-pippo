"use client";

import { Button, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { PromotionRule } from "@/lib/promotions";
import type { SlotSelection } from "../types/promo-combo.types";

const { Text } = Typography;

interface Props {
  comboPrice: number;
  rules: PromotionRule[];
  selections: (SlotSelection | null)[];
  allFilled: boolean;
  isMobile: boolean;
  onConfirm: () => void;
}

export function PromoComboSummaryPanel({ comboPrice, rules, selections, allFilled, isMobile, onConfirm }: Props) {
  const t = useTranslations("pos.comboSummary");

  return (
    <div style={{ flex: isMobile ? "none" : "0 0 180px", width: isMobile ? "100%" : undefined, display: "flex", flexDirection: isMobile ? "row" : "column", gap: 12, alignItems: isMobile ? "center" : undefined }}>
      <div style={{ padding: "16px 14px", background: "#fff7ed", borderRadius: 10, border: "1px solid #fed7aa", textAlign: "center" }}>
        <Text style={{ color: "#c2410c", fontSize: 12, display: "block", marginBottom: 4 }}>{t("price")}</Text>
        <Text strong style={{ color: "#ea580c", fontSize: 24 }}>Bs {comboPrice.toFixed(2)}</Text>
      </div>
      {!isMobile && (
        <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          {rules.map((_, idx) => {
            const sel = selections[idx];
            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: idx < rules.length - 1 ? 6 : 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: sel ? "#ea580c" : "#e5e7eb", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sel && <CheckOutlined style={{ fontSize: 9, color: "#fff" }} />}
                </div>
                <Text style={{ fontSize: 11, color: sel ? "#374151" : "#9ca3af" }}>
                  {sel ? `${sel.productName}${sel.variantName !== "Unidad" && sel.variantName !== sel.productName ? ` ${sel.variantName}` : ""}` : t("slotPending", { n: idx + 1 })}
                </Text>
              </div>
            );
          })}
        </div>
      )}
      <Button
        type="primary"
        size="large"
        block={!isMobile}
        disabled={!allFilled}
        onClick={onConfirm}
        style={{ background: allFilled ? "#ea580c" : undefined, borderColor: allFilled ? "#ea580c" : undefined, whiteSpace: "nowrap" }}
      >
        {isMobile ? t("addMobile", { price: comboPrice.toFixed(2) }) : t("addCombo")}
      </Button>
    </div>
  );
}
