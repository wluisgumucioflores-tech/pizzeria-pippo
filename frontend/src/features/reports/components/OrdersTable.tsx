"use client";

import { Card, Table, Tag, Tooltip, Typography, Button } from "antd";
import { StopOutlined } from "@ant-design/icons";
import { formatDateTimeBolivia } from "@/lib/timezone";
import { PAYMENT_PROVIDERS } from "@pippo/shared";
import { OrderItemsTable } from "./OrderItemsTable";
import { OrdersMobileList } from "./OrdersMobileList";
import { OrdersStatsRow } from "./OrdersStatsRow";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Order, SalesSummary } from "../types/reports.types";

const { Text } = Typography;

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

function buildOrderColumns(onCancel: (order: Order) => void) {
  return [
    {
      title: "Fecha y hora",
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => formatDateTimeBolivia(d),
    },
    { title: "Sucursal", key: "branch", render: (_: unknown, o: Order) => o.branches?.name ?? "—" },
    { title: "Cajero", key: "cashier", render: (_: unknown, o: Order) => o.cashier_name },
    {
      title: "Items",
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
      title: "Tipo",
      dataIndex: "order_type",
      key: "order_type",
      render: (t: string) =>
        t === "takeaway" ? <Tag color="purple">🥡 Para llevar</Tag> : <Tag color="orange">🍽️ Comer aquí</Tag>,
    },
    {
      title: "Pago",
      dataIndex: "payment_method",
      key: "payment_method",
      render: (m: string | null, o: Order) => {
        if (m === "efectivo") return <Tag color="green">💵 Efectivo</Tag>;
        if (m === "qr") return <Tag color="blue">📱 QR</Tag>;
        if (m === "mixto") {
          const breakdown = o.payments
            .map((p) => `${p.method === "efectivo" ? "💵" : "📱"} Bs ${p.amount.toFixed(2)}`)
            .join(" + ");
          return (
            <Tooltip title={breakdown}>
              <Tag color="gold">🔀 Mixto</Tag>
            </Tooltip>
          );
        }
        if (m === "online") {
          const known = o.payment_provider
            ? PAYMENT_PROVIDERS[o.payment_provider as keyof typeof PAYMENT_PROVIDERS]
            : undefined;
          return <Tag color="geekblue">{known ? `${known.emoji} ${known.label}` : "🌐 Online"}</Tag>;
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right" as const,
      render: (t: number, o: Order) =>
        o.cancelled_at ? (
          <Text delete type="secondary">Bs {Number(t).toFixed(2)}</Text>
        ) : (
          <Text strong style={{ color: "#f97316" }}>Bs {Number(t).toFixed(2)}</Text>
        ),
    },
    {
      title: "Estado",
      key: "status",
      render: (_: unknown, o: Order) => {
        if (o.cancelled_at) {
          return (
            <Tooltip title={o.cancel_reason ?? ""}>
              <Tag color="red" icon={<StopOutlined />}>Anulada</Tag>
            </Tooltip>
          );
        }
        return (
          <Button size="small" danger ghost icon={<StopOutlined />} onClick={() => onCancel(o)}>
            Anular
          </Button>
        );
      },
    },
  ];
}

export function OrdersTable({ orders, ordersTotal, ordersPage, ordersPageSize, loading, exporting, summary, onPageChange, onExport, onCancel }: Props) {
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

  const columns = buildOrderColumns(onCancel);

  return (
    <>
      <OrdersStatsRow summary={summary} loading={loading} />
      <Card
        size="small"
        extra={
          <Button icon={<IconExcel />} loading={exporting} disabled={orders.length === 0} onClick={onExport}>
            Exportar Excel
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
            showTotal: (t) => `${t} ventas`,
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
