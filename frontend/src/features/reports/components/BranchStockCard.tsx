"use client";

import { Card, Space, Typography, Avatar, Table } from "antd";
import { InboxOutlined, AppstoreOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { BranchElaboratedStock } from "../types/reports.types";

const { Text } = Typography;

interface Props {
  branchStock: BranchElaboratedStock[];
  updatedLabel: string | null;
}

export function BranchStockCard({ branchStock, updatedLabel }: Props) {
  const t = useTranslations("reports");

  if (branchStock.length === 0) return null;

  return (
    <Card
      size="small"
      title={
        <Space>
          <InboxOutlined style={{ color: "#f97316" }} />
          <Text strong>{t("branchStock.title")}</Text>
        </Space>
      }
      extra={updatedLabel && <Text type="secondary" style={{ fontSize: 12 }}>{updatedLabel}</Text>}
      style={{ marginBottom: 24 }}
    >
      <Table
        dataSource={branchStock}
        rowKey="variant_id"
        pagination={false}
        size="small"
        columns={[
          {
            title: t("columns.product"),
            key: "product",
            render: (_: unknown, r: BranchElaboratedStock) => (
              <Space>
                <Avatar shape="square" icon={<AppstoreOutlined />} style={{ backgroundColor: "#fed7aa", color: "#ea580c" }} />
                <Space direction="vertical" size={0}>
                  <Text strong>{r.product_name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{r.variant_name}</Text>
                </Space>
              </Space>
            ),
          },
          {
            title: t("branchStock.unitType"),
            key: "unit_type",
            render: () => <Text type="secondary">{t("branchStock.unit")}</Text>,
          },
          {
            title: t("branchStock.sold"),
            dataIndex: "sold_quantity",
            key: "sold_quantity",
            align: "right" as const,
            sorter: (a: BranchElaboratedStock, b: BranchElaboratedStock) => b.sold_quantity - a.sold_quantity,
            render: (qty: number) => <Text>{qty}</Text>,
          },
          {
            title: t("branchStock.remaining"),
            dataIndex: "quantity",
            key: "quantity",
            align: "right" as const,
            sorter: (a: BranchElaboratedStock, b: BranchElaboratedStock) => b.quantity - a.quantity,
            render: (qty: number) => <Text strong>{qty}</Text>,
          },
        ]}
      />
    </Card>
  );
}
