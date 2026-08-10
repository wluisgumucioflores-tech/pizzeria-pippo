"use client";

import { Table, Tag, Space, Button, Tooltip, Typography, Spin, Modal, Form, InputNumber, Input } from "antd";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWarehouseProductTable } from "../hooks/useWarehouseProductTable";

const { Text } = Typography;

const IconWarning = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconEdit = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconSwap = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);

function variantLabel(row: { product_variants: { name: string; products: { name: string } | null } | null }): string {
  const pv = row.product_variants;
  if (!pv) return "—";
  const productName = pv.products?.name ?? "";
  return pv.name === "Unidad" ? productName : `${productName} — ${pv.name}`;
}

export function WarehouseProductTable({ isMobile }: { isMobile: boolean }) {
  const router = useRouter();
  const t = useTranslations("common");
  const tw = useTranslations("warehouse");
  const { rows, loading, adjustingRow, adjustLoading, adjustForm, alertCount, openAdjust, closeAdjust, handleAdjust } = useWarehouseProductTable();

  const columns = [
    {
      title: tw("columns.product"),
      key: "product",
      render: (_: unknown, row: ReturnType<typeof useWarehouseProductTable>["rows"][0]) => (
        <Space>
          {row.quantity < row.min_quantity && (
            <Tooltip title={tw("lowStockTooltip")}><IconWarning /></Tooltip>
          )}
          <Text strong>{variantLabel(row)}</Text>
        </Space>
      ),
    },
    {
      title: tw("columns.warehouseStock"),
      key: "quantity",
      render: (_: unknown, row: ReturnType<typeof useWarehouseProductTable>["rows"][0]) => (
        <Text strong style={{ color: row.quantity < row.min_quantity ? "#ef4444" : "#16a34a" }}>
          {row.quantity} {tw("unitAbbrev")}
        </Text>
      ),
    },
    {
      title: tw("columns.minimum"),
      key: "min_quantity",
      render: (_: unknown, row: ReturnType<typeof useWarehouseProductTable>["rows"][0]) => (
        <Text>{row.min_quantity} {tw("unitAbbrev")}</Text>
      ),
    },
    {
      title: tw("columns.status"),
      key: "status",
      render: (_: unknown, row: ReturnType<typeof useWarehouseProductTable>["rows"][0]) =>
        row.quantity < row.min_quantity
          ? <Tag color="red">{tw("statusLow")}</Tag>
          : <Tag color="green">{tw("statusOk")}</Tag>,
    },
    {
      title: t("actions"),
      key: "action",
      render: (_: unknown, row: ReturnType<typeof useWarehouseProductTable>["rows"][0]) => (
        <Space>
          <Button size="small" icon={<IconEdit />} onClick={() => openAdjust(row)}>{tw("adjust")}</Button>
          <Button size="small" icon={<IconSwap />} onClick={() => router.push(`/warehouse/transfer?variantId=${row.variant_id}`)}>
            {tw("transfer")}
          </Button>
        </Space>
      ),
    },
  ];

  if (loading && !rows.length) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spin size="large" /></div>;
  }

  return (
    <>
      {alertCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Tag color="orange" icon={<IconWarning />}>
            {tw("lowStockAlertProduct", { count: alertCount })}
          </Tag>
        </div>
      )}

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((row) => {
            const isLow = row.quantity < row.min_quantity;
            return (
              <div key={row.id} style={{ background: isLow ? "#fef2f2" : "#fff", border: `1px solid ${isLow ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isLow && <IconWarning />}
                    <Text strong style={{ fontSize: 15 }}>{variantLabel(row)}</Text>
                  </div>
                  {isLow ? <Tag color="red" style={{ margin: 0 }}>{tw("statusLow")}</Tag> : <Tag color="green" style={{ margin: 0 }}>{tw("statusOk")}</Tag>}
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{tw("stockLabel")}</Text>
                    <Text strong style={{ color: isLow ? "#ef4444" : "#16a34a" }}>{row.quantity} {tw("unitAbbrev")}</Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{tw("minLabel")}</Text>
                    <Text strong>{row.min_quantity} {tw("unitAbbrev")}</Text>
                  </div>
                </div>
                <Space>
                  <Button size="small" icon={<IconEdit />} onClick={() => openAdjust(row)}>{tw("adjust")}</Button>
                  <Button size="small" icon={<IconSwap />} onClick={() => router.push(`/warehouse/transfer?variantId=${row.variant_id}`)}>
                    {tw("transfer")}
                  </Button>
                </Space>
              </div>
            );
          })}
          {rows.length === 0 && !loading && (
            <Text type="secondary" style={{ textAlign: "center", display: "block", padding: 32 }}>
              {tw("noResaleProducts")}
            </Text>
          )}
        </div>
      ) : (
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (count) => tw("totalProducts", { count }) }}
          rowClassName={(row) => row.quantity < row.min_quantity ? "bg-red-50" : ""}
          size="middle"
          locale={{ emptyText: tw("noResaleProducts") }}
        />
      )}

      <Modal
        open={!!adjustingRow}
        title={tw("adjustModalTitle", { name: adjustingRow ? variantLabel(adjustingRow) : "" })}
        onCancel={closeAdjust}
        footer={null}
        destroyOnHidden
      >
        <Form form={adjustForm} layout="vertical" onFinish={handleAdjust}>
          <Form.Item label={tw("realQuantityUnits")} name="real_quantity" rules={[{ required: true, message: tw("requiredQuantity") }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label={tw("adjustReason")} name="notes">
            <Input.TextArea rows={2} placeholder={tw("adjustReasonPlaceholderShort")} />
          </Form.Item>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button onClick={closeAdjust}>{t("cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={adjustLoading}>{tw("confirmAdjust")}</Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
