"use client";

import { Card, Tag, Tooltip, Typography, Collapse, Button } from "antd";
import { useTranslations } from "next-intl";
import { formatDateTimeBolivia } from "@/lib/timezone";
import { OrderItemsTable } from "./OrderItemsTable";
import { OrdersStatsRow } from "./OrdersStatsRow";
import type { Order, SalesSummary } from "../types/reports.types";

const { Text } = Typography;

const ORDER_TYPE_COLOR: Record<string, string> = {
  dine_in: "orange",
  takeaway: "purple",
  delivery: "cyan",
  pedidos_ya: "gold",
};

const ORDER_TYPE_SHORT_KEY: Record<string, string> = {
  dine_in: "orderType.dineInShort",
  takeaway: "orderType.takeawayShort",
  delivery: "orderType.deliveryShort",
  pedidos_ya: "orderType.pedidosYaShort",
};

const IconExcel = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

interface Props {
  orders: Order[];
  ordersTotal: number;
  ordersPage: number;
  ordersPageSize: number;
  loading: boolean;
  exporting: boolean;
  summary: SalesSummary | null;
  onPageChange: (page: number, pageSize: number) => void;
  onExport: () => void;
}

export function OrdersMobileList({ orders, ordersTotal, ordersPage, ordersPageSize, loading, exporting, summary, onPageChange, onExport }: Props) {
  const t = useTranslations("reports");
  return (
    <>
    <OrdersStatsRow summary={summary} loading={loading} />
    <Card
      size="small"
      extra={
        <Button size="small" icon={<IconExcel />} loading={exporting} disabled={orders.length === 0} onClick={onExport}>
          {t("export")}
        </Button>
      }
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>{t("loading")}</div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>{t("noSalesInPeriod")}</div>
      ) : (
        <>
          <Collapse
            size="small"
            items={orders.map((order) => {
              const full = formatDateTimeBolivia(order.created_at); // DD/MM/YYYY HH:mm
              const fecha = `${full.slice(0, 5)} ${full.slice(11)}`; // DD/MM HH:mm
              const nombres = order.order_items
                .map((i) => `${i.qty}x ${i.product_variants?.products?.name}`)
                .join(", ");
              return {
                key: order.id,
                label: (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <Text style={{ fontSize: 12, color: "#6b7280" }}>{fecha}</Text>
                        <Tag color={ORDER_TYPE_COLOR[order.order_type] ?? "default"} style={{ margin: 0, fontSize: 10 }}>
                          {t(ORDER_TYPE_SHORT_KEY[order.order_type] ?? "orderType.dineInShort")}
                        </Tag>
                        {order.payment_method === "efectivo"
                          ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>💵</Tag>
                          : order.payment_method === "qr"
                          ? <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>📱</Tag>
                          : order.payment_method === "mixto"
                          ? (
                            <Tooltip title={order.payments.map((p) => `${p.method === "efectivo" ? "💵" : "📱"} Bs ${p.amount.toFixed(2)}`).join(" + ")}>
                              <Tag color="gold" style={{ margin: 0, fontSize: 10 }}>🔀</Tag>
                            </Tooltip>
                          )
                          : order.payment_method === "online"
                          ? <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>🌐</Tag>
                          : !order.cancelled_at
                          ? <Tag color="volcano" style={{ margin: 0, fontSize: 10 }}>Pendiente</Tag>
                          : null}
                      </div>
                      <Text style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 200 }}>{nombres}</Text>
                    </div>
                    <Text strong style={{ color: "#f97316", fontSize: 15, flexShrink: 0 }}>
                      Bs {Number(order.total).toFixed(2)}
                    </Text>
                  </div>
                ),
                children: <OrderItemsTable items={order.order_items} notes={order.notes} />,
              };
            })}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
            <Text type="secondary" style={{ fontSize: 13 }}>{t("salesCount", { count: ordersTotal })}</Text>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={ordersPage === 1}
                onClick={() => onPageChange(ordersPage - 1, ordersPageSize)}
                style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #d9d9d9", background: ordersPage === 1 ? "#f5f5f5" : "#fff", cursor: ordersPage === 1 ? "not-allowed" : "pointer", color: ordersPage === 1 ? "#bfbfbf" : "#374151" }}
              >
                {t("prev")}
              </button>
              <Text type="secondary" style={{ lineHeight: "30px", fontSize: 13 }}>{t("page", { page: ordersPage })}</Text>
              <button
                disabled={ordersPage * 20 >= ordersTotal}
                onClick={() => onPageChange(ordersPage + 1, ordersPageSize)}
                style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #d9d9d9", background: ordersPage * 20 >= ordersTotal ? "#f5f5f5" : "#fff", cursor: ordersPage * 20 >= ordersTotal ? "not-allowed" : "pointer", color: ordersPage * 20 >= ordersTotal ? "#bfbfbf" : "#374151" }}
              >
                {t("next")}
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
    </>
  );
}
