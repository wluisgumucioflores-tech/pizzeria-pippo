"use client";

import { Table, Button, Tag, Space, Typography, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { VariantType } from "../types/variant-type.types";

const { Title, Text } = Typography;

interface Props {
  variantTypes: VariantType[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (record: VariantType) => void;
  onToggle: (record: VariantType) => void;
}

export function VariantTypesTable({ variantTypes, loading, onCreate, onEdit, onToggle }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("common");
  const tv = useTranslations("variantTypes");

  const columns = [
    { title: tv("columns.name"), dataIndex: "name", key: "name" },
    {
      title: tv("columns.status"),
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      render: (active: boolean) =>
        active ? <Tag color="green">{tv("active")}</Tag> : <Tag color="default">{tv("inactive")}</Tag>,
    },
    {
      title: t("actions"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: VariantType) => (
        <Space>
          <Tooltip title={t("edit")}>
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
          </Tooltip>
          <Tooltip title={record.is_active ? tv("deactivate") : tv("activate")}>
            <Button
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              size="small"
              danger={record.is_active}
              onClick={() => onToggle(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <Title level={4} style={{ margin: 0 }}>{tv("title")}</Title>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        {tv("new")}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {header}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>{t("loading")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {variantTypes.map((vt) => (
              <div
                key={vt.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <Text strong style={{ fontSize: 15 }}>{vt.name}</Text>
                  <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                    {vt.is_active
                      ? <Tag color="green" style={{ margin: 0 }}>{tv("active")}</Tag>
                      : <Tag color="default" style={{ margin: 0 }}>{tv("inactive")}</Tag>}
                  </div>
                </div>
                <Space size={6}>
                  <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(vt)} />
                  <Button
                    icon={vt.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                    size="small"
                    danger={vt.is_active}
                    onClick={() => onToggle(vt)}
                  />
                </Space>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      {header}
      <Table
        dataSource={variantTypes}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
      />
    </div>
  );
}
