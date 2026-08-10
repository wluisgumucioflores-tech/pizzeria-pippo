"use client";

import { Typography } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface Props {
  total: number;
  totalDiscount: number;
  isEmpty: boolean;
  onConfirm: () => void;
  onClear: () => void;
}

export function PosCartFooter({ total, totalDiscount, isEmpty, onConfirm, onClear }: Props) {
  const t = useTranslations("pos");

  return (
    <div style={{ borderTop: "1px solid #e5e7eb", background: "#fff", padding: "16px 20px" }}>
      {totalDiscount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
          <Text type="secondary">{t("cartPanel.discountsApplied")}</Text>
          <Text style={{ color: "#16a34a", fontWeight: 600 }}>- Bs {totalDiscount.toFixed(2)}</Text>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <Text style={{ color: "#6b7280", fontSize: 16 }}>{t("total")}</Text>
        <Text strong style={{ fontSize: 32, color: "#ea580c" }}>Bs {total.toFixed(2)}</Text>
      </div>

      <button
        disabled={isEmpty}
        onClick={onConfirm}
        style={{
          width: "100%", padding: "14px 0", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8,
          cursor: isEmpty ? "not-allowed" : "pointer",
          background: isEmpty ? "#f3f4f6" : "#ea580c",
          color: isEmpty ? "#9ca3af" : "#fff",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { if (!isEmpty) (e.currentTarget as HTMLButtonElement).style.background = "#dc4a08"; }}
        onMouseLeave={(e) => { if (!isEmpty) (e.currentTarget as HTMLButtonElement).style.background = "#ea580c"; }}
      >
        <CheckOutlined />
        {t("confirmSale")}
      </button>

      <button
        disabled={isEmpty}
        onClick={onClear}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 500, fontSize: 14,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: isEmpty ? "not-allowed" : "pointer",
          background: "transparent",
          color: isEmpty ? "#d1d5db" : "#f87171",
          transition: "color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => { if (!isEmpty) { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; } }}
        onMouseLeave={(e) => { if (!isEmpty) { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; } }}
      >
        <CloseOutlined />
        {t("cancelOrder")}
      </button>
    </div>
  );
}
