"use client";

import { Drawer, Tag, Typography, Divider, Space } from "antd";
import { useTranslations } from "next-intl";
import { getTypeOptions, TYPE_COLORS, getDays } from "../constants/promotion.constants";
import type { Promotion, Branch, Variant, Rule } from "../types/promotion.types";

const { Text, Title } = Typography;

interface Props {
  promotion: Promotion | null;
  branches: Branch[];
  variants: Variant[];
  onClose: () => void;
}

export function PromotionDetailDrawer({ promotion, branches, variants, onClose }: Props) {
  const tp = useTranslations("promotions");
  if (!promotion) return null;

  const branchName = promotion.branch_id
    ? (branches.find((b) => b.id === promotion.branch_id)?.name ?? promotion.branch_id)
    : null;

  const DAYS = getDays(tp);
  const activeDays = DAYS.filter((d) => promotion.days_of_week.includes(d.value));
  const typeLabel = getTypeOptions(tp).find((o) => o.value === promotion.type)?.label ?? promotion.type;

  return (
    <Drawer
      title={<Title level={5} style={{ margin: 0 }}>{promotion.name}</Title>}
      open={!!promotion}
      onClose={onClose}
      width={420}
    >
      {/* Status & type */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag color={TYPE_COLORS[promotion.type]}>{typeLabel}</Tag>
        {promotion.active
          ? <Tag color="green">{tp("statusActive")}</Tag>
          : <Tag color="default">{tp("statusPaused")}</Tag>}
        {!promotion.is_active && <Tag color="red">{tp("statusDeleted")}</Tag>}
        {branchName
          ? <Tag>{branchName}</Tag>
          : <Tag color="purple">{tp("allBranches")}</Tag>}
      </Space>

      {/* Dates & days */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>{tp("validity")}</Text>
        <Text>{promotion.start_date} → {promotion.end_date}</Text>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>{tp("days")}</Text>
        <Space size={4} wrap>
          {DAYS.map((d) => (
            <Tag key={d.value} color={activeDays.some((a) => a.value === d.value) ? "blue" : "default"}>
              {d.label}
            </Tag>
          ))}
        </Space>
      </div>

      <Divider style={{ margin: "12px 0" }} />

      {/* Rules */}
      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 10 }}>{tp("rules")}</Text>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {promotion.promotion_rules?.length === 0 && (
          <Text type="secondary" style={{ fontStyle: "italic" }}>{tp("noRulesConfigured")}</Text>
        )}
        {promotion.promotion_rules?.map((rule, i) => (
          <RuleRow key={i} index={i} rule={rule} type={promotion.type} variants={variants} />
        ))}
      </div>
    </Drawer>
  );
}

function RuleRow({ index, rule, type, variants }: { index: number; rule: Rule; type: string; variants: Variant[] }) {
  const t = useTranslations("promotions");
  const variantLabel = rule.variant_id
    ? (() => {
        const v = variants.find((v) => v.id === rule.variant_id);
        return v ? `${v.product_name} — ${v.name}` : rule.variant_id;
      })()
    : null;

  return (
    <div style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {type === "COMBO" ? t("slotLabel", { n: index + 1 }) : t("ruleLabel", { n: index + 1 })}
      </Text>

      {type === "BUY_X_GET_Y" && (
        <div style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 13 }}>
            {t.rich("buyGetText", {
              buy: rule.buy_qty ?? 0,
              get: rule.get_qty ?? 0,
              b: (chunks) => <Text strong>{chunks}</Text>,
            })}
          </Text>
          {variantLabel && (
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 2 }}>{variantLabel}</Text>
          )}
        </div>
      )}

      {type === "PERCENTAGE" && (
        <div style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 13 }}>
            {t.rich("discountText", { percent: rule.discount_percent ?? 0, b: (chunks) => <Text strong>{chunks}</Text> })}
          </Text>
          {variantLabel
            ? <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 2 }}>{variantLabel}</Text>
            : <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 2 }}>{t("allProducts")}</Text>}
        </div>
      )}

      {type === "COMBO" && (
        <div style={{ marginTop: 4 }}>
          {rule.variant_id ? (
            <Text style={{ fontSize: 13 }}>{variantLabel}</Text>
          ) : (
            <Space size={4}>
              {rule.category && <Tag>{rule.category}</Tag>}
              {rule.variant_size && <Tag>{rule.variant_size}</Tag>}
            </Space>
          )}
          {index === 0 && rule.combo_price != null && (
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
              {t("comboPriceText", { price: Number(rule.combo_price).toFixed(2) })}
            </Text>
          )}
        </div>
      )}
    </div>
  );
}
