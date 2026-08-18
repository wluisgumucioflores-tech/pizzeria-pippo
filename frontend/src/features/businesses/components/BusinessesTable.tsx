"use client";

import { Table, Button, Space, Tag, Typography, Tooltip, Popconfirm } from "antd";
import { PlusOutlined, StopOutlined, CheckCircleOutlined, EyeOutlined, EditOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Business } from "../types/business.types";

const { Title, Text } = Typography;

interface Props {
  businesses: Business[];
  loading: boolean;
  onCreate: () => void;
  onToggleActive: (business: Business) => void;
  onViewDetail: (business: Business) => void;
  onEdit: (business: Business) => void;
}

export function BusinessesTable({ businesses, loading, onCreate, onToggleActive, onViewDetail, onEdit }: Props) {
  const t = useTranslations("common");
  const columns = [
    {
      title: "Nombre",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Business) => (
        <Space>
          <Text delete={!record.is_active} style={!record.is_active ? { color: "#9ca3af" } : {}}>
            {name}
          </Text>
          {!record.is_active && <Tag color="default">Suspendido</Tag>}
        </Space>
      ),
    },
    {
      title: "Fecha de alta",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    },
    {
      title: t("actions"),
      key: "actions",
      width: 160,
      render: (_: unknown, record: Business) => (
        <Space size="small">
          <Tooltip title="Ver detalle">
            <Button icon={<EyeOutlined />} size="small" onClick={() => onViewDetail(record)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
          </Tooltip>
          <Popconfirm
            title={record.is_active ? "¿Suspender este negocio?" : "¿Reactivar este negocio?"}
            description={record.is_active ? "Sus usuarios no podrán operar mientras esté suspendido." : undefined}
            onConfirm={() => onToggleActive(record)}
            okText={record.is_active ? "Suspender" : "Reactivar"}
            cancelText={t("cancel")}
            okButtonProps={{ danger: record.is_active }}
          >
            <Tooltip title={record.is_active ? "Suspender" : "Reactivar"}>
              <Button
                icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                size="small"
                danger={record.is_active}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Negocios</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          Nuevo negocio
        </Button>
      </div>
      <Table
        dataSource={businesses}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </>
  );
}
