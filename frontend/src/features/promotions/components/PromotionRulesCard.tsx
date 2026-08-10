"use client";

import { Card, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { Rule } from "../types/promotion.types";

const { Text } = Typography;

interface Props {
  rules: Rule[];
  type: string;
  variants: { id: string; name: string; product_name: string }[];
}

export function PromotionRulesCard({ rules, type, variants }: Props) {
  const t = useTranslations("promotions");

  return (
    <Card title={<Text strong>{t("rules")}</Text>}>
      {(!rules || rules.length === 0) && (
        <Text type="secondary" style={{ fontStyle: "italic" }}>{t("noRulesConfigured")}</Text>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rules?.map((rule, i) => (
          <RuleCard key={i} index={i} rule={rule} type={type} variants={variants} />
        ))}
      </div>
    </Card>
  );
}

function RuleCard({ index, rule, type, variants }: {
  index: number;
  rule: Rule;
  type: string;
  variants: { id: string; name: string; product_name: string }[];
}) {
  const t = useTranslations("promotions");
  const categoryLabels: Record<string, string> = {
    pizza: t("categories.pizza"),
    bebida: t("categories.bebida"),
    otro: t("categories.otro"),
  };
  const variant = rule.variant_id ? variants.find((v) => v.id === rule.variant_id) : null;
  const variantLabel = variant ? `${variant.product_name} — ${variant.name}` : null;
  const isFlexible = !rule.variant_id && (rule.category || rule.variant_size);

  return (
    <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
      <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
        {type === "COMBO" ? t("slotLabel", { n: index + 1 }) : t("ruleLabel", { n: index + 1 })}
      </Text>

      {type === "BUY_X_GET_Y" && (
        <Space wrap>
          <Text style={{ fontSize: 14 }}>
            {t.rich("buyGetText", {
              buy: rule.buy_qty ?? 0,
              get: rule.get_qty ?? 0,
              b: (chunks) => <Text strong>{chunks}</Text>,
            })}
          </Text>
          {variantLabel && <Tag>{variantLabel}</Tag>}
        </Space>
      )}

      {type === "PERCENTAGE" && (
        <Space wrap>
          <Tag color="blue" style={{ fontSize: 14 }}>{t("discountBadge", { percent: rule.discount_percent ?? 0 })}</Tag>
          {variantLabel
            ? <Text>{variantLabel}</Text>
            : <Text type="secondary">{t("allProducts")}</Text>}
        </Space>
      )}

      {type === "COMBO" && (
        <Space wrap>
          {isFlexible ? (
            <>
              {rule.category && <Tag>{categoryLabels[rule.category] ?? rule.category}</Tag>}
              {rule.variant_size && <Tag>{rule.variant_size}</Tag>}
            </>
          ) : (
            variantLabel ? <Text>{variantLabel}</Text> : <Text type="secondary">—</Text>
          )}
          {index === 0 && rule.combo_price != null && (
            <Tag color="green">{t("comboPriceText", { price: Number(rule.combo_price).toFixed(2) })}</Tag>
          )}
        </Space>
      )}
    </div>
  );
}
