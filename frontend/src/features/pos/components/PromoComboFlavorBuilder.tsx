"use client";

import { useState, useEffect } from "react";
import { Typography, Select } from "antd";
import { PlusOutlined, MinusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Product, Variant } from "../types/pos.types";
import type { FlavorEntry } from "../types/promo-combo.types";

const { Text } = Typography;

interface Props {
  selectedVariant: Variant;
  product: Product;
  products: Product[];
  onChange: (flavors: FlavorEntry[]) => void;
}

export function PromoComboFlavorBuilder({ selectedVariant, product, products, onChange }: Props) {
  const t = useTranslations("pos.flavors");
  const [flavors, setFlavors] = useState<FlavorEntry[]>([
    { variantId: selectedVariant.id, productName: product.name, parts: 1 },
  ]);

  useEffect(() => {
    onChange(flavors);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flavors]);

  const pizzaProducts = products.filter((p) => p.category === "pizza" && p.is_active !== false);
  const selectedIds = new Set(flavors.map((f) => f.variantId));
  const flavorOptions = pizzaProducts.flatMap((p) =>
    p.product_variants
      .filter((v) => v.name === selectedVariant.name && v.is_active !== false && !selectedIds.has(v.id))
      .map((v) => ({ value: v.id, label: `${p.name}`, productName: p.name }))
  );

  const totalParts = flavors.reduce((s, f) => s + f.parts, 0);

  const addFlavor = (variantId: string) => {
    const opt = flavorOptions.find((o) => o.value === variantId);
    if (!opt) return;
    setFlavors((prev) => [...prev, { variantId, productName: opt.productName, parts: 1 }]);
  };

  const updateParts = (idx: number, delta: number) => {
    setFlavors((prev) => prev.map((f, i) => i === idx ? { ...f, parts: Math.max(1, f.parts + delta) } : f));
  };

  const removeFlavor = (idx: number) => {
    setFlavors((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{t("title")}</Text>
      {flavors.map((flavor, idx) => {
        const fraction = `${flavor.parts}/${totalParts}`;
        const barWidth = Math.round((flavor.parts / totalParts) * 100);
        return (
          <div key={flavor.variantId} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 10px", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text strong style={{ fontSize: 13 }}>{flavor.productName}</Text>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{fraction}</Text>
                {flavors.length > 1 && (
                  <button onClick={() => removeFlavor(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}>
                    <DeleteOutlined style={{ fontSize: 12 }} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ height: 4, background: "#e5e7eb", borderRadius: 4, marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${barWidth}%`, background: "#ea580c", borderRadius: 4, transition: "width 0.2s" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => updateParts(idx, -1)} disabled={flavor.parts <= 1} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: flavor.parts <= 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: flavor.parts <= 1 ? 0.4 : 1 }}>
                <MinusOutlined style={{ fontSize: 10 }} />
              </button>
              <Text strong style={{ fontSize: 13, width: 16, textAlign: "center" }}>{flavor.parts}</Text>
              <button onClick={() => updateParts(idx, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PlusOutlined style={{ fontSize: 10 }} />
              </button>
              <Text type="secondary" style={{ fontSize: 11 }}>{t("partsCount", { count: flavor.parts })}</Text>
            </div>
          </div>
        );
      })}
      {flavorOptions.length > 0 && (
        <Select
          placeholder={t("addAnother")}
          value={undefined}
          onChange={addFlavor}
          options={flavorOptions}
          style={{ width: "100%" }}
          suffixIcon={<PlusOutlined />}
        />
      )}
    </div>
  );
}
