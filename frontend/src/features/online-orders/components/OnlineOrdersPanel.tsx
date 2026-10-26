"use client";

import { useState } from "react";
import { Button, Card, Empty, Input, Modal, Space, Tag, Typography } from "antd";
import { CheckOutlined, CloseOutlined, PhoneOutlined, ReloadOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { formatTimeBolivia } from "@/lib/timezone";
import { minutesLeft } from "../lib/expiry";
import type { OnlineOrderRow } from "../types/manage.types";

const { Text } = Typography;

interface Props {
  orders: OnlineOrderRow[];
  loaded: boolean;
  acting: string | null;
  onRefresh: () => void;
  onConfirm: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

export function OnlineOrdersPanel({ orders, loaded, acting, onRefresh, onConfirm, onReject }: Props) {
  const t = useTranslations("pos.onlineOrders");
  const [rejecting, setRejecting] = useState<OnlineOrderRow | null>(null);
  const [reason, setReason] = useState("");

  const closeReject = () => {
    setRejecting(null);
    setReason("");
  };

  const submitReject = () => {
    if (!rejecting || reason.trim().length < 3) return;
    onReject(rejecting.id, reason.trim());
    closeReject();
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text strong>{t("title")}</Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
          {t("refresh")}
        </Button>
      </div>

      {orders.length === 0 ? (
        <Empty description={loaded ? t("empty") : t("loading")} style={{ marginTop: 48 }} />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {orders.map((order) => {
            const left = minutesLeft(order.expires_at);
            const busy = acting === order.id;

            return (
              <Card key={order.id} size="small" styles={{ body: { padding: 14 } }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Tag color="purple" style={{ margin: 0, fontWeight: 700 }}>#{order.reference}</Tag>
                  <Text strong>{order.customer_name}</Text>
                  {/* Tappable on the tablet: the cashier often needs to call. */}
                  <a href={`tel:${order.customer_phone}`} style={{ fontSize: 13 }}>
                    <PhoneOutlined /> {order.customer_phone}
                  </a>
                  <div style={{ flex: 1 }} />
                  {/* Red under 5 minutes so an about-to-expire request stands out. */}
                  <Tag color={left <= 5 ? "red" : "default"} style={{ margin: 0 }}>
                    {t("expiresIn", { minutes: left })}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatTimeBolivia(new Date(order.created_at))}
                  </Text>
                </div>

                <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
                  {order.items.map((item) => (
                    <li key={item.variant_id} style={{ fontSize: 13 }}>
                      {item.qty}× {item.product_name} {item.variant_name}
                      <Text type="secondary"> — {Math.round(item.unit_price * item.qty * 100) / 100} Bs</Text>
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
                    📝 {order.notes}
                  </Text>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text strong style={{ fontSize: 16 }}>{order.total} Bs</Text>
                  <div style={{ flex: 1 }} />
                  <Button
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    disabled={busy}
                    onClick={() => setRejecting(order)}
                  >
                    {t("reject")}
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={busy}
                    onClick={() => onConfirm(order.id)}
                  >
                    {t("confirm")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </Space>
      )}

      <Modal
        open={rejecting !== null}
        centered
        title={t("rejectTitle", { reference: rejecting?.reference ?? "" })}
        okText={t("reject")}
        cancelText={t("cancel")}
        okButtonProps={{ danger: true, disabled: reason.trim().length < 3 }}
        onOk={submitReject}
        onCancel={closeReject}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          {t("rejectHint")}
        </Text>
        <Input.TextArea
          rows={3}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("rejectPlaceholder")}
        />
      </Modal>
    </div>
  );
}
