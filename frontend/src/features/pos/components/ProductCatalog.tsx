"use client";

import { useState } from "react";
import { Tag, Typography, Empty, Spin, Button } from "antd";
import NextImage from "next/image";
import { useTranslations } from "next-intl";
import type { Product } from "../types/pos.types";

const { Text } = Typography;

const CATEGORY_COLORS: Record<string, string> = {
  pizza: "red",
  bebida: "blue",
  otro: "green",
};

interface Props {
  products: Product[];
  loading: boolean;
  branchId: string;
  getVariantPrice: (variant: Product["product_variants"][0], branchId: string) => number;
  getPromoLabel: (variantId: string) => string | null;
  onProductClick: (product: Product) => void;
}

export function ProductCatalog({ products, loading, branchId, getVariantPrice, getPromoLabel, onProductClick }: Props) {
  const [filterCategory, setFilterCategory] = useState("all");
  const t = useTranslations("pos");
  const CATEGORY_OPTIONS = [
    { value: "all", label: t("allCategories") },
    { value: "pizza", label: t("catalog.categories.pizza") },
    { value: "bebida", label: t("catalog.categories.bebida") },
    { value: "otro", label: t("catalog.categories.otro") },
  ];

  const isResaleVariant = (v: Product["product_variants"][0]) =>
    !v.recipes?.length && v.stock_quantity !== undefined;

  const filterActiveVariants = (product: Product) => {
    const active = (product.product_variants ?? []).filter((v) => v.is_active !== false);
    if (!active.some(isResaleVariant)) return active;
    // Resale variants: must have a stock row AND a branch_price for this branch
    return active.filter((v) => {
      if (!isResaleVariant(v)) return true;
      const hasStock = v.stock_quantity !== null;
      const hasPrice = v.branch_prices?.some((bp) => bp.branch_id === branchId);
      return hasStock && hasPrice;
    });
  };

  const baseFiltered = filterCategory === "all"
    ? products
    : products.filter((p) => p.category === filterCategory);

  const filteredProducts = baseFiltered
    .map((p) => ({ ...p, product_variants: filterActiveVariants(p) }))
    .filter((p) => p.product_variants.length > 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px", background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
        {CATEGORY_OPTIONS.map((c) => (
          <Button
            key={c.value}
            type={filterCategory === c.value ? "primary" : "default"}
            size="middle"
            onClick={() => setFilterCategory(c.value)}
            style={filterCategory === c.value ? { background: "#ea580c", borderColor: "#ea580c" } : {}}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Spin size="large" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <Empty description={t("catalog.noProducts")} style={{ marginTop: 60 }} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {filteredProducts.map((product) => {
              const variants = product.product_variants ?? [];
              const firstVariant = variants[0];
              const price = firstVariant ? getVariantPrice(firstVariant, branchId) : 0;
              const hasMultipleVariants = variants.length > 1;
              const promoLabels = variants.map((v) => getPromoLabel(v.id)).filter(Boolean);
              const promoLabel = promoLabels?.[0] ?? null;
              const allResale = variants.length > 0 && variants.every(isResaleVariant);
              const soldOut = allResale && variants.every((v) => v.stock_quantity === 0);

              return (
                <div
                  key={product.id}
                  onClick={() => !soldOut && onProductClick(product)}
                  style={{
                    background: soldOut ? "#f9fafb" : "#fff",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    cursor: soldOut ? "not-allowed" : "pointer",
                    overflow: "hidden",
                    transition: "box-shadow 0.15s, transform 0.1s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    opacity: soldOut ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (soldOut) return;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  }}
                >
                  {/* Image */}
                  <div style={{ position: "relative" }}>
                    {product.image_url ? (
                      <NextImage src={product.image_url} alt={product.name} width={300} height={130} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: 130, background: "linear-gradient(135deg, #fff7ed, #fed7aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>
                        {product.category === "pizza" ? "🍕" : product.category === "bebida" ? "🥤" : "🍽️"}
                      </div>
                    )}
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      <Tag color={CATEGORY_COLORS[product.category]} style={{ margin: 0, fontSize: 11 }}>{product.category}</Tag>
                    </div>
                    {promoLabel && (
                      <div style={{ position: "absolute", top: 8, right: 8 }}>
                        <Tag color="volcano" style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>{promoLabel}</Tag>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: "10px 12px" }}>
                    <Text strong style={{ fontSize: 13, display: "block", lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {product.name}
                    </Text>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <Text style={{ color: soldOut ? "#9ca3af" : "#ea580c", fontWeight: 700, fontSize: 14 }}>
                        {soldOut ? t("catalog.soldOut") : hasMultipleVariants ? t("catalog.fromPrice", { price }) : `Bs ${price}`}
                      </Text>
                      {!soldOut && hasMultipleVariants && (
                        <Text type="secondary" style={{ fontSize: 11 }}>{t("catalog.various")}</Text>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
