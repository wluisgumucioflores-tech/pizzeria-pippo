"use client";

import { Modal, Button, Tag, Typography, Divider } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { PAYMENT_PROVIDERS } from "@pippo/shared";
import { useTranslations } from "next-intl";
import type { TicketData } from "../types/pos.types";

const { Text } = Typography;

function paymentLabel(
  method: TicketData["paymentMethod"],
  provider: string | null,
  payments: TicketData["payments"],
  labels: { cash: string; qr: string; online: string },
): string {
  if (method === "efectivo") return labels.cash;
  if (method === "qr") return labels.qr;
  if (method === "mixto" && payments?.length) {
    return payments.map((p) => `${p.method === "efectivo" ? "💵" : "📱"} Bs ${p.amount.toFixed(2)}`).join(" + ");
  }
  if (method === "online") {
    const known = provider ? PAYMENT_PROVIDERS[provider as keyof typeof PAYMENT_PROVIDERS] : undefined;
    return known ? `${known.emoji} ${known.label}` : labels.online;
  }
  return "—";
}

interface Props {
  ticket: TicketData | null;
  onClose: () => void;
  onPrint?: () => void;
  printing?: boolean;
  canPrint?: boolean;
}

export function TicketModal({ ticket, onClose, onPrint, printing, canPrint }: Props) {
  const t = useTranslations("pos");
  const tt = useTranslations("pos.ticketModal");
  const labels = { cash: t("paymentLabel.cash"), qr: t("paymentLabel.qr"), online: t("paymentLabel.online") };

  return (
    <Modal
      title={tt("title")}
      open={!!ticket}
      onCancel={onClose}
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          {canPrint && onPrint && (
            <Button
              size="large"
              icon={<PrinterOutlined />}
              loading={printing}
              onClick={onPrint}
              style={{ flex: 1 }}
            >
              {tt("print")}
            </Button>
          )}
          <Button type="primary" size="large" onClick={onClose} style={{ flex: 2 }}>
            {t("newSale")}
          </Button>
        </div>
      }
      width={400}
    >
      {ticket && (
        <div className="mt-4">
          <div className="text-center mb-4">
            <Text strong className="text-4xl text-orange-600">
              #{String(ticket.dailyNumber).padStart(2, "0")}
            </Text>
            {(ticket.tableNumber || ticket.waiterName) && (
              <div className="mt-1">
                {ticket.tableNumber && <Text type="secondary" className="block text-sm">🪑 Mesa {ticket.tableNumber}</Text>}
                {ticket.waiterName && <Text type="secondary" className="block text-sm">🙋 {ticket.waiterName}</Text>}
              </div>
            )}
          </div>
          {ticket.items.map((item, idx) => (
            <div key={`${item.variant_id}-${idx}`} className="flex justify-between py-1 border-b last:border-0">
              <div>
                <Text>
                  {item.qty_physical}x {item.product_name}
                  {item.flavors?.length
                    ? ` — ${t("halfAndHalf", { first: item.flavors[0].product_name, second: item.flavors[1].product_name })}`
                    : ` (${item.variant_name})`}
                </Text>
                {item.promo_label && <Tag color="red" className="!ml-1 !text-xs">{item.promo_label}</Tag>}
              </div>
              <Text>Bs {(item.unit_price * item.qty_physical - item.discount_applied).toFixed(2)}</Text>
            </div>
          ))}
          <Divider className="!my-2" />
          <div className="flex justify-between mb-1">
            <Text strong>{tt("totalCharged")}</Text>
            <Text strong className="text-orange-600">Bs {ticket.total.toFixed(2)}</Text>
          </div>
          <div className="flex justify-between">
            <Text type="secondary">{tt("paymentMethodLabel")}</Text>
            <Text>{paymentLabel(ticket.paymentMethod, ticket.paymentProvider, ticket.payments, labels)}</Text>
          </div>
          {ticket.notes && (
            <>
              <Divider className="!my-2" />
              <Text type="secondary" className="block text-xs">Nota:</Text>
              <Text className="block text-sm">{ticket.notes}</Text>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
