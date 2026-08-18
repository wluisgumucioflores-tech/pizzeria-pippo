"use client";

import { Table, Tag, Typography, Space } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { useCategoryOptions } from "@/features/categories/hooks/useCategoryOptions";
import type { OrderItem } from "../types/reports.types";

const { Text } = Typography;

type ReportsTranslator = ReturnType<typeof useTranslations>;

function buildOrderItemColumns(t: ReportsTranslator, categoryLabel: (categoryId: string | null) => string) {
  return [
    {
      title: t("columns.product"),
      key: "product",
      render: (_: unknown, item: OrderItem) => (
        <Space direction="vertical" size={0}>
          <Text strong>{item.product_variants?.products?.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{item.product_variants?.name}</Text>
        </Space>
      ),
    },
    {
      title: t("columns.category"),
      key: "category",
      render: (_: unknown, item: OrderItem) => <Tag>{categoryLabel(item.product_variants?.products?.category_id ?? null)}</Tag>,
    },
    { title: t("columns.qty"), dataIndex: "qty", key: "qty", width: 60, render: (qty: number) => <Text strong>{qty}</Text> },
    {
      title: t("columns.unitPrice"),
      dataIndex: "unit_price",
      key: "unit_price",
      render: (p: number, item: OrderItem) => (
        <Space size={4}>
          {`Bs ${Number(p).toFixed(2)}`}
          {item.price_edited && <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>Editado</Tag>}
        </Space>
      ),
    },
    {
      title: t("columns.discount"),
      dataIndex: "discount_applied",
      key: "discount_applied",
      render: (d: number) =>
        Number(d) > 0 ? <Text style={{ color: "#ef4444" }}>-Bs {Number(d).toFixed(2)}</Text> : <Text type="secondary">{t("payment.none")}</Text>,
    },
    {
      title: t("columns.promo"),
      dataIndex: "promo_label",
      key: "promo_label",
      render: (label: string | null, item: OrderItem) =>
        label && Number(item.discount_applied) > 0 ? <Tag color="orange">{label}</Tag> : <Text type="secondary">{t("payment.none")}</Text>,
    },
    {
      title: t("columns.subtotal"),
      key: "subtotal",
      render: (_: unknown, item: OrderItem) => {
        const sub = (Number(item.unit_price) * item.qty) - Number(item.discount_applied);
        return <Text strong style={{ color: "#f97316" }}>Bs {sub.toFixed(2)}</Text>;
      },
    },
  ];
}

interface Props {
  items: OrderItem[];
  notes?: string | null;
}

function OrderNote({ notes }: { notes?: string | null }) {
  if (!notes) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 10px", marginBottom: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6 }}>
      <FileTextOutlined style={{ color: "#b45309", marginTop: 2, flexShrink: 0 }} />
      <Text style={{ fontSize: 12.5, color: "#92400e" }}>{notes}</Text>
    </div>
  );
}

export function OrderItemsTable({ items, notes }: Props) {
  const t = useTranslations("reports");
  const isMobile = useIsMobile();
  const { options: categoryOptions } = useCategoryOptions();
  const categoryLabel = (categoryId: string | null) =>
    categoryOptions.find((c) => c.value === categoryId)?.label ?? "—";
  const orderItemColumns = buildOrderItemColumns(t, categoryLabel);

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
        <OrderNote notes={notes} />
        {items.map((item, i) => {
          const cat = categoryLabel(item.product_variants?.products?.category_id ?? null);
          const sub = (Number(item.unit_price) * item.qty) - Number(item.discount_applied);
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              <div>
                <Text strong style={{ fontSize: 13 }}>{item.product_variants?.products?.name}</Text>
                <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{item.product_variants?.name}</Text>
                  <Tag style={{ margin: 0, fontSize: 10, lineHeight: "16px" }}>{cat}</Tag>
                  {item.promo_label && Number(item.discount_applied) > 0 && (
                    <Tag color="orange" style={{ margin: 0, fontSize: 10, lineHeight: "16px" }}>{item.promo_label}</Tag>
                  )}
                  {item.price_edited && (
                    <Tag color="purple" style={{ margin: 0, fontSize: 10, lineHeight: "16px" }}>Editado</Tag>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Text strong style={{ color: "#f97316", display: "block" }}>Bs {sub.toFixed(2)}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{item.qty}x · Bs {Number(item.unit_price).toFixed(2)}</Text>
                {Number(item.discount_applied) > 0 && (
                  <Text style={{ color: "#16a34a", fontSize: 11, display: "block" }}>-Bs {Number(item.discount_applied).toFixed(2)}</Text>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <OrderNote notes={notes} />
      <Table
        dataSource={items}
        rowKey={(item) => `${item.product_variants?.name}-${item.qty}`}
        size="small"
        pagination={false}
        columns={orderItemColumns}
      />
    </div>
  );
}
