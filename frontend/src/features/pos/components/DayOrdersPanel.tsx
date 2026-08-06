"use client";

import { Button, Empty, Tag, Tooltip, Typography } from "antd";
import { CheckCircleOutlined, FileTextOutlined, StopOutlined } from "@ant-design/icons";
import { formatTimeBolivia } from "@/lib/timezone";
import { useIsMobile } from "@/lib/useIsMobile";
import type { DayOrder } from "../types/pos.types";

const { Text } = Typography;

interface Props {
  dayOrders: DayOrder[];
  markingReady: string | null;
  onMarkReady: (orderId: string) => void;
  onCancel: (order: DayOrder) => void;
}

export function DayOrdersPanel({ dayOrders, markingReady, onMarkReady, onCancel }: Props) {
  const isMobile = useIsMobile();

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 12 : 24, background: "#f5f5f5" }}>
      <Text strong style={{ fontSize: 15, color: "#374151", display: "block", marginBottom: 12 }}>
        Pedidos del día ({dayOrders.length})
      </Text>

      {dayOrders.length === 0 ? (
        <Empty description="Sin ventas registradas hoy." style={{ marginTop: 60 }} />
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
                    <span style={{ fontSize: 14 }}>
                      {order.payment_method === "efectivo" ? "💵" : order.payment_method === "qr" ? "📱" : order.payment_method === "online" ? "🌐" : order.payment_method === "mixto" ? "🔀" : "—"}
                    </span>
                  </div>
                  {/* Row 2: summary */}
                  <Text style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 8 }} ellipsis>{summary}</Text>
                  {/* Row 3: tags + actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Tag color={order.order_type === "takeaway" ? "blue" : "green"} style={{ margin: 0, fontSize: 11 }}>
                      {order.order_type === "takeaway" ? "🥡 Para llevar" : "🍽️ Local"}
                    </Tag>
                    {order.notes && (
                      <Tooltip title={order.notes}>
                        <FileTextOutlined style={{ color: "#9ca3af", fontSize: 13 }} />
                      </Tooltip>
                    )}
                    <div style={{ flex: 1 }} />
                    {isCancelled ? (
                      <Tag color="red" icon={<StopOutlined />} style={{ margin: 0 }}>Anulada</Tag>
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
                          Listo
                        </Button>
                        <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(order)} />
                      </>
                    ) : (
                      <>
                        <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                          <CheckCircleOutlined /> Listo
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
                  <Tag color={order.order_type === "takeaway" ? "blue" : "green"} style={{ flexShrink: 0, margin: 0 }}>
                    {order.order_type === "takeaway" ? "🥡 Para llevar" : "🍽️ Local"}
                  </Tag>
                  {order.notes && (
                    <Tooltip title={order.notes}>
                      <FileTextOutlined style={{ flexShrink: 0, color: "#9ca3af", fontSize: 14 }} />
                    </Tooltip>
                  )}
                  <span style={{ flexShrink: 0, fontSize: 14 }}>
                    {order.payment_method === "efectivo" ? "💵" : order.payment_method === "qr" ? "📱" : order.payment_method === "online" ? "🌐" : order.payment_method === "mixto" ? "🔀" : "—"}
                  </span>
                </div>
                <div style={{ marginLeft: 12, flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
                  {isCancelled ? (
                    <Tag color="red" icon={<StopOutlined />}>Anulada</Tag>
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
                        Marcar listo
                      </Button>
                      <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(order)}>
                        Anular
                      </Button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircleOutlined /> Listo
                      </span>
                      <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(order)}>
                        Anular
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
