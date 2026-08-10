"use client";

import { Card, Space, Tag, Typography, Table } from "antd";
import { useTranslations } from "next-intl";
import type { ProductDetailVariant, ProductDetailRecipeItem } from "../types/product.types";

const { Text } = Typography;

interface Props {
  variants: ProductDetailVariant[];
  isMobile: boolean;
}

export function ProductVariantsList({ variants, isMobile }: Props) {
  const t = useTranslations("products");
  const tc = useTranslations("products.variants.conditions");
  const CONDITION_LABELS: Record<string, string> = { always: tc("always"), takeaway: tc("takeaway"), dine_in: tc("dine_in") };

  const recipeColumns = [
    { title: t("recipe.ingredient"), key: "name", render: (_: unknown, r: ProductDetailRecipeItem) => <Text>{r.ingredients?.name}</Text> },
    { title: t("columns.unit"), key: "unit", render: (_: unknown, r: ProductDetailRecipeItem) => <Tag>{r.ingredients?.unit}</Tag> },
    { title: t("recipe.quantity"), dataIndex: "quantity", key: "quantity", render: (q: number) => <Text strong>{q}</Text> },
    {
      title: t("columns.condition"), key: "condition",
      render: (_: unknown, r: ProductDetailRecipeItem) => (
        <Tag color={r.apply_condition === "takeaway" ? "blue" : r.apply_condition === "dine_in" ? "orange" : "default"}>
          {CONDITION_LABELS[r.apply_condition ?? "always"] ?? r.apply_condition}
        </Tag>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      {variants?.map((variant) => (
        <Card
          key={variant.id}
          size="small"
          title={<Space><Text strong style={{ fontSize: 15 }}>{variant.name}</Text>{!variant.is_active && <Tag color="default">{t("inactiveTag")}</Tag>}</Space>}
          extra={
            <Space wrap>
              {variant.branch_prices?.length > 0
                ? variant.branch_prices.map((bp) => (
                    <Tag key={bp.branch_id} color="orange">{bp.branches?.name}: Bs {Number(bp.price).toFixed(2)}</Tag>
                  ))
                : <Tag color="orange">Bs {Number(variant.base_price).toFixed(2)}</Tag>}
            </Space>
          }
          style={!variant.is_active ? { opacity: 0.6 } : {}}
        >
          {variant.recipes?.length > 0 ? (
            <>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>{t("variants.recipeTitle")}</Text>
              {isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {variant.recipes.map((r) => (
                    <div key={r.ingredient_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f9fafb", borderRadius: 8 }}>
                      <div>
                        <Text strong style={{ fontSize: 13 }}>{r.ingredients?.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>({r.ingredients?.unit})</Text>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Text strong>{r.quantity}</Text>
                        <Tag color={r.apply_condition === "takeaway" ? "blue" : r.apply_condition === "dine_in" ? "orange" : "default"} style={{ margin: 0, fontSize: 11 }}>
                          {CONDITION_LABELS[r.apply_condition ?? "always"]}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table dataSource={variant.recipes} columns={recipeColumns} rowKey="ingredient_id" pagination={false} size="small" />
              )}
            </>
          ) : (
            <Text type="secondary">{t("noRecipe")}</Text>
          )}
        </Card>
      ))}
    </Space>
  );
}
