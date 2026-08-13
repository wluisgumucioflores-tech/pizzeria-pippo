"use client";

import { Button, Empty, Tag, Tooltip, Typography } from "antd";
import { CheckCircleOutlined, FileTextOutlined, PlusOutlined, PrinterOutlined, StopOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { formatTimeBolivia } from "@/lib/timezone";
import { useIsMobile } from "@/lib/useIsMobile";
import type { DayOrder } from "../types/pos.types";

const { Text } = Typography;

const ORDER_TYPE_COLOR: Record<string, string> = {
  dine_in: "green",
  takeaway: "blue",
  delivery: "cyan",
  pedidos_ya: "gold",
};

const ORDER_TYPE_LABEL_KEY: Record<string, string> = {
  dine_in: "orderType.dineInLocal",
  takeaway: "orderType.takeawayLocal",
  delivery: "orderType.deliveryLocal",
  pedidos_ya: "orderType.pedidosYaLocal",
};

interface Props {
  dayOrders: DayOrder[];
  markingReady: string | null;
  onMarkReady: (orderId: string) => void;
  onCancel: (order: DayOrder) => void;
  onPay: (order: DayOrder) => void;
  onPrint: (order: DayOrder) => void;
  onAddItems: (order: DayOrder) => void;
}

export function DayOrdersPanel({ dayOrders, markingReady, onMarkReady, onCancel, onPay, onPrint, onAddItems }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("pos");
  const td = useTranslations("pos.dayOrders");

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 12 : 24, background: "#f5f5f5" }}>
      <Text strong style={{ fontSize: 15, color: "#374151", display: "block", marginBottom: 12 }}>
        {td("title", { count: dayOrders.length })}
      </Text>

      {dayOrders.length === 0 ? (
        <Empty description={td("empty")} style={{ marginTop: 60 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dayOrders.map((order) => {
            const orderLabel = `#${String(order.daily_number).padStart(2, "0")}`;
            const timeStr = formatTimeBolivia(order.created_at);
            const summary = order.order_items
              .map((i) => `${i.qty}x ${i.product_variants?.products?.name ?? ""} ${i.product_variants?.name ?? ""}`)
              .join(", ");
            const isPending = order.kitchen_status === "pending";
            const isCancelled = order.cancelled_at !== null;
            const isPaid = !!order.payment_method;

            if (isMobile) {
              return (
                <div
                  key={order.id}
                  style={{
                    borderRadius: 10,
                    padding: "10px 12px",
                    border: `1px solid ${isCancelled ? "#e5e7eb" : isPending ? "#fed7aa" : "#e5e7eb"}`,
                    background: isCancelled ? "#f3f4f6" : isPending ? "#fff7ed" : "#fff",
                    opacity: isCancelled ? 0.6 : 1,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Row 1: order number + time + total + type */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text strong style={{ color: "#374151", fontSize: 14 }}>{orderLabel}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{timeStr}</Text>
                    <div style={{ flex: 1 }} />
                    <Text strong style={{ color: "#ea580c", fontSize: 14 }}>Bs {Number(order.total).toFixed(2)}</Text>
                    {!order.payment_method && !isCancelled ? (
                      <Button size="small" type="primary" onClick={() => onPay(order)} style={{ background: "#16a34a", borderColor: "#16a34a", fontSize: 12 }}>
                        Cobrar
                      </Button>
                    ) : (
                      <span style={{ fontSize: 14 }}>
                        {order.payment_method === "efectivo" ? "💵" : order.payment_method === "qr" ? "📱" : order.payment_method === "online" ? "🌐" : order.payment_method === "mixto" ? "🔀" : "—"}
                      </span>
                    )}
                  </div>
                  {/* Row 2: summary */}
                  <Text style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 8 }} ellipsis>{summary}</Text>
                  {/* Row 3: tags + actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Tag color={ORDER_TYPE_COLOR[order.order_type]} style={{ margin: 0, fontSize: 11 }}>
                      {t(ORDER_TYPE_LABEL_KEY[order.order_type])}
                    </Tag>
                    {order.table_number && <Tag style={{ margin: 0, fontSize: 11 }}>🪑 {order.table_number}</Tag>}
                    {order.waiter_name && <Tag style={{ margin: 0, fontSize: 11 }}>🙋 {order.waiter_name}</Tag>}
                    {order.notes && (
                      <Tooltip title={order.notes}>
                        <FileTextOutlined style={{ color: "#9ca3af", fontSize: 13 }} />
                      </Tooltip>
                    )}
                    <div style={{ flex: 1 }} />
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => onPrint(order)} />
                    {!isCancelled && (
                      <Tooltip title={isPaid ? td("addItemsDisabled") : undefined}>
                        <Button size="small" icon={<PlusOutlined />} disabled={isPaid} onClick={() => onAddItems(order)}>
                          {td("addItems")}
                        </Button>
                      </Tooltip>
                    )}
                    {isCancelled ? (
                      <Tag color="red" icon={<StopOutlined />} style={{ margin: 0 }}>{td("cancelled")}</Tag>
                    ) : isPending ? (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          loading={markingReady === order.id}
                          onClick={() => onMarkReady(order.id)}
                          style={{ background: "#ea580c", borderColor: "#ea580c", fontSize: 12 }}
                        >
                          {td("readyShort")}
                        </Button>
                        <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(order)} />
                      </>
                    ) : (
                      <>
                        <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                          <CheckCircleOutlined /> {td("readyShort")}
                        </span>
                        <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(order)} />
                      </>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={order.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  border: `1px solid ${isCancelled ? "#e5e7eb" : isPending ? "#fed7aa" : "#e5e7eb"}`,
                  background: isCancelled ? "#f3f4f6" : isPending ? "#fff7ed" : "#fff",
                  opacity: isCancelled ? 0.6 : 1,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <Text strong style={{ flexShrink: 0, color: "#374151", fontSize: 14 }}>{orderLabel}</Text>
                  <Text type="secondary" style={{ flexShrink: 0, fontSize: 12 }}>{timeStr}</Text>
                  <Text style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontSize: 13, color: "#6b7280" }}>{summary}</Text>
                  <Text strong style={{ flexShrink: 0, color: "#ea580c", fontSize: 14 }}>Bs {Number(order.total).toFixed(2)}</Text>
                  <Tag color={ORDER_TYPE_COLOR[order.order_type]} style={{ flexShrink: 0, margin: 0 }}>
                    {t(ORDER_TYPE_LABEL_KEY[order.order_type])}
                  </Tag>
                  {order.table_number && <Tag style={{ flexShrink: 0, margin: 0 }}>🪑 {order.table_number}</Tag>}
                  {order.waiter_name && <Tag style={{ flexShrink: 0, margin: 0 }}>🙋 {order.waiter_name}</Tag>}
                  {order.notes && (
                    <Tooltip title={order.notes}>
                      <FileTextOutlined style={{ flexShrink: 0, color: "#9ca3af", fontSize: 14 }} />
                    </Tooltip>
                  )}
                  {!order.payment_method && !isCancelled ? (
                    <Button size="small" type="primary" onClick={() => onPay(order)} style={{ flexShrink: 0, background: "#16a34a", borderColor: "#16a34a" }}>
                      Cobrar
                    </Button>
                  ) : (
                    <span style={{ flexShrink: 0, fontSize: 14 }}>
                      {order.payment_method === "efectivo" ? "💵" : order.payment_method === "qr" ? "📱" : order.payment_method === "online" ? "🌐" : order.payment_method === "mixto" ? "🔀" : "—"}
                    </span>
                  )}
                </div>
                <div style={{ marginLeft: 12, flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
                  <Button size="small" icon={<PrinterOutlined />} onClick={() => onPrint(order)} />
                  {!isCancelled && (
                    <Tooltip title={isPaid ? td("addItemsDisabled") : undefined}>
                      <Button size="small" icon={<PlusOutlined />} disabled={isPaid} onClick={() => onAddItems(order)}>
                        {td("addItems")}
                      </Button>
                    </Tooltip>
                  )}
                  {isCancelled ? (
                    <Tag color="red" icon={<StopOutlined />}>{td("cancelled")}</Tag>
                  ) : isPending ? (
                    <>
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        loading={markingReady === order.id}
                        onClick={() => onMarkReady(order.id)}
                        style={{ background: "#ea580c", borderColor: "#ea580c" }}
                      >
                        {td("markReady")}
                      </Button>
                      <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(order)}>
                        {td("cancelAction")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircleOutlined /> {td("readyShort")}
                      </span>
                      <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(order)}>
                        {td("cancelAction")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
