"use client";

import NextImage from "next/image";
import { useTranslations } from "next-intl";
import type { DisplayProduct } from "../types/display.types";

const CATEGORY_EMOJI: Record<string, string> = {
  pizza: "🍕",
  bebida: "🥤",
  otro: "🍽️",
};

interface Props {
  products: DisplayProduct[];
  menuPage: number;
}

export function DisplayMenu({ products, menuPage }: Props) {
  const t = useTranslations("display");
  const categoryLabel: Record<string, string> = {
    pizza: t("categories.pizza"),
    bebida: t("categories.bebida"),
    otro: t("categories.otro"),
  };
  const categories = Array.from(new Set(products.map((p) => p.category)));
  const visibleProducts = products.slice(menuPage * 6, menuPage * 6 + 6);
  const totalPages = Math.ceil(products.length / 6);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px 24px" }}>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexShrink: 0 }}>
        {categories.map((cat) => (
          <div
            key={cat}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#1f2937", padding: "8px 18px", borderRadius: 999, fontSize: 15, fontWeight: 500 }}
          >
            <span>{CATEGORY_EMOJI[cat] ?? "🍽️"}</span>
            <span>{categoryLabel[cat] ?? cat}</span>
          </div>
        ))}
      </div>

      {/* Product grid — 3 columns, 2 rows = 6 per page */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, overflow: "hidden" }}>
        {visibleProducts.map((product) => {
          const minPrice = product.product_variants?.length
            ? Math.min(...product.product_variants.map((v) => v.base_price))
            : 0;
          const hasVariants = (product.product_variants?.length ?? 0) > 1;

          return (
            <div
              key={product.id}
              style={{ background: "#1f2937", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              {product.image_url ? (
                <NextImage
                  src={product.image_url}
                  alt={product.name}
                  width={400}
                  height={160}
                  style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ width: "100%", height: 160, background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>
                  {CATEGORY_EMOJI[product.category] ?? "🍽️"}
                </div>
              )}
              <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.3, margin: 0 }}>{product.name}</h3>
                  {product.description && (
                    <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 4, marginBottom: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {product.description}
                    </p>
                  )}
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#fb923c", fontWeight: 700, fontSize: 20 }}>
                    {hasVariants ? t("fromPrice", { price: minPrice }) : `Bs ${minPrice}`}
                  </span>
                  {hasVariants && (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{t("variousSizes")}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Page indicator dots */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, flexShrink: 0 }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 8,
                width: i === menuPage ? 24 : 8,
                borderRadius: 999,
                background: i === menuPage ? "#fb923c" : "#374151",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
