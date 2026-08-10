"use client";

import Link from "next/link";
import { Row, Col, Card, Space, Typography, Tag, Badge } from "antd";
import { useTranslations } from "next-intl";
import type { StockAlert, WarehouseAlert } from "../types/dashboard.types";

const { Text } = Typography;

const IconWarning = ({ color }: { color: string }) => (
  <svg className="inline w-4 h-4" style={{ color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconArrow = () => (
  <svg className="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

interface Props {
  stockAlerts: StockAlert[];
  warehouseAlerts: WarehouseAlert[];
}

export function DashboardStockAlerts({ stockAlerts, warehouseAlerts }: Props) {
  const t = useTranslations("dashboard");
  return (
    <>
      {stockAlerts.length > 0 && (
        <Card
          title={
            <Space>
              <IconWarning color="#ef4444" />
              <Text>{t("lowStockBranches")}</Text>
              <Badge count={stockAlerts.length} color="#ef4444" />
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Link href="/stock" className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600">
              {t("goToStock")} <IconArrow />
            </Link>
          }
        >
          <Row gutter={[8, 8]}>
            {stockAlerts.map((alert) => (
              <Col xs={24} sm={12} lg={8} key={alert.id}>
                <Card size="small" style={{ borderColor: "#fca5a5", background: "#fff5f5" }}>
                  <Space direction="vertical" size={2} style={{ width: "100%" }}>
                    <Space>
                      <IconWarning color="#ef4444" />
                      <Text strong style={{ fontSize: 13 }}>{alert.ingredients?.name}</Text>
                      <Tag>{alert.ingredients?.unit}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{alert.branches?.name}</Text>
                    <Space>
                      <Text style={{ color: "#ef4444", fontWeight: 700 }}>{alert.quantity}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>/ {t("minShort", { min: alert.min_quantity })}</Text>
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {warehouseAlerts.length > 0 && (
        <Card
          title={
            <Space>
              <IconWarning color="#f97316" />
              <Text>{t("lowStockWarehouse")}</Text>
              <Badge count={warehouseAlerts.length} color="#f97316" />
            </Space>
          }
          size="small"
          extra={
            <Link href="/warehouse" className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600">
              {t("goToWarehouse")} <IconArrow />
            </Link>
          }
        >
          <Row gutter={[8, 8]}>
            {warehouseAlerts.map((alert) => (
              <Col xs={24} sm={12} lg={8} key={alert.id}>
                <Card size="small" style={{ borderColor: "#fed7aa", background: "#fff7ed" }}>
                  <Space direction="vertical" size={2} style={{ width: "100%" }}>
                    <Space>
                      <IconWarning color="#f97316" />
                      <Text strong style={{ fontSize: 13 }}>{alert.ingredients?.name}</Text>
                      <Tag>{alert.ingredients?.unit}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t("centralWarehouse")}</Text>
                    <Space>
                      <Text style={{ color: "#f97316", fontWeight: 700 }}>{alert.quantity}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>/ {t("minShort", { min: alert.min_quantity })}</Text>
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </>
  );
}
