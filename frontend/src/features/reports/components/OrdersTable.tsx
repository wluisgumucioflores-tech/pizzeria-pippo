"use client";

import { Card, Table, Tag, Tooltip, Typography, Button } from "antd";
import { StopOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { formatDateTimeBolivia } from "@/lib/timezone";
import { PAYMENT_PROVIDERS } from "@pippo/shared";
import { OrderItemsTable } from "./OrderItemsTable";
import { OrdersMobileList } from "./OrdersMobileList";
import { OrdersStatsRow } from "./OrdersStatsRow";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Order, SalesSummary } from "../types/reports.types";

const { Text } = Typography;

const ORDER_TYPE_COLOR: Record<string, string> = {
  dine_in: "orange",
  takeaway: "purple",
  delivery: "cyan",
  pedidos_ya: "gold",
};

const ORDER_TYPE_KEY: Record<string, string> = {
  dine_in: "orderType.dineIn",
  takeaway: "orderType.takeaway",
  delivery: "orderType.delivery",
  pedidos_ya: "orderType.pedidosYa",
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
  onCancel: (order: Order) => void;
}

type ReportsTranslator = ReturnType<typeof useTranslations>;

function buildOrderColumns(onCancel: (order: Order) => void, t: ReportsTranslator) {
  return [
    {
      title: t("columns.dateTime"),
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => formatDateTimeBolivia(d),
    },
    { title: t("columns.branch"), key: "branch", render: (_: unknown, o: Order) => o.branches?.name ?? t("payment.none") },
    { title: t("columns.cashier"), key: "cashier", render: (_: unknown, o: Order) => o.cashier_name },
    {
      title: t("columns.items"),
      key: "items",
      render: (_: unknown, o: Order) => {
        const names = o.order_items
          .map((i) => `${i.qty}x ${i.product_variants?.products?.name} ${i.product_variants?.name}`)
          .join(", ");
        return (
          <Text style={{ maxWidth: 280, display: "inline-block" }} ellipsis={{ tooltip: names }}>
            {names}
          </Text>
        );
      },
    },
    {
      title: t("columns.type"),
      dataIndex: "order_type",
      key: "order_type",
      render: (type: string) =>
        <Tag color={ORDER_TYPE_COLOR[type] ?? "default"}>{t(ORDER_TYPE_KEY[type] ?? "orderType.dineIn")}</Tag>,
    },
    {
      title: t("columns.payment"),
      dataIndex: "payment_method",
      key: "payment_method",
      render: (m: string | null, o: Order) => {
        if (m === "efectivo") return <Tag color="green">{t("payment.cash")}</Tag>;
        if (m === "qr") return <Tag color="blue">{t("payment.qr")}</Tag>;
        if (m === "mixto") {
          const breakdown = o.payments
            .map((p) => `${p.method === "efectivo" ? "💵" : "📱"} Bs ${p.amount.toFixed(2)}`)
            .join(" + ");
          return (
            <Tooltip title={breakdown}>
              <Tag color="gold">{t("payment.mixed")}</Tag>
            </Tooltip>
          );
        }
        if (m === "online") {
          const known = o.payment_provider
            ? PAYMENT_PROVIDERS[o.payment_provider as keyof typeof PAYMENT_PROVIDERS]
            : undefined;
          return <Tag color="geekblue">{known ? `${known.emoji} ${known.label}` : t("payment.online")}</Tag>;
        }
        // Fase 4 — cobro diferido: sin método de pago y sin cancelar = todavía no se cobró.
        if (!o.cancelled_at) return <Tag color="volcano">Pendiente de cobro</Tag>;
        return <Text type="secondary">{t("payment.none")}</Text>;
      },
    },
    {
      title: t("columns.total"),
      dataIndex: "total",
      key: "total",
      align: "right" as const,
      render: (total: number, o: Order) =>
        o.cancelled_at ? (
          <Text delete type="secondary">Bs {Number(total).toFixed(2)}</Text>
        ) : (
          <Text strong style={{ color: "#f97316" }}>Bs {Number(total).toFixed(2)}</Text>
        ),
    },
    {
      title: t("columns.status"),
      key: "status",
      render: (_: unknown, o: Order) => {
        if (o.cancelled_at) {
          return (
            <Tooltip title={o.cancel_reason ?? ""}>
              <Tag color="red" icon={<StopOutlined />}>{t("status.cancelled")}</Tag>
            </Tooltip>
          );
        }
        return (
          <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(o)}>
            {t("status.cancelAction")}
          </Button>
        );
      },
    },
  ];
}

export function OrdersTable({ orders, ordersTotal, ordersPage, ordersPageSize, loading, exporting, summary, onPageChange, onExport, onCancel }: Props) {
  const t = useTranslations("reports");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <OrdersMobileList
        orders={orders}
        ordersTotal={ordersTotal}
        ordersPage={ordersPage}
        ordersPageSize={ordersPageSize}
        loading={loading}
        exporting={exporting}
        summary={summary}
        onPageChange={onPageChange}
        onExport={onExport}
      />
    );
  }

  const columns = buildOrderColumns(onCancel, t);

  return (
    <>
      <OrdersStatsRow summary={summary} loading={loading} />
      <Card
        size="small"
        extra={
          <Button icon={<IconExcel />} loading={exporting} disabled={orders.length === 0} onClick={onExport}>
            {t("exportExcel")}
          </Button>
        }
      >
        <Table
          dataSource={orders}
          rowKey="id"
          loading={loading}
          size="small"
          rowClassName={(o) => o.cancelled_at ? "opacity-60 bg-gray-50" : ""}
          pagination={{
            current: ordersPage,
            pageSize: ordersPageSize,
            total: ordersTotal,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => t("salesCount", { count: total }),
            onChange: onPageChange,
          }}
          expandable={{
            expandedRowRender: (order) => <OrderItemsTable items={order.order_items} notes={order.notes} />,
          }}
          columns={columns}
        />
      </Card>
    </>
  );
}
