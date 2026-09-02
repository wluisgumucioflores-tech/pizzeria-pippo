"use client";

import { Table, Button, Space, Tag, Typography, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { AiModel } from "../types/aiModel.types";

const { Title, Text } = Typography;

interface Props {
  models: AiModel[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (model: AiModel) => void;
  onToggleActive: (model: AiModel) => void;
}

export function AiModelsTable({ models, loading, onCreate, onEdit, onToggleActive }: Props) {
  const columns = [
    {
      title: "Modelo",
      key: "label",
      render: (_: unknown, record: AiModel) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text delete={!record.is_active} style={!record.is_active ? { color: "#9ca3af" } : {}}>
              {record.label}
            </Text>
            {record.is_default && <Tag color="blue">Default</Tag>}
            {!record.is_active && <Tag color="default">Inactivo</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.provider} · {record.model_id}
          </Text>
        </Space>
      ),
    },
    {
      title: "Tipo",
      key: "type",
      render: (_: unknown, record: AiModel) => (record.is_local ? <Tag>Local</Tag> : <Tag color="purple">Cloud</Tag>),
    },
    {
      title: "Base URL",
      dataIndex: "base_url",
      key: "base_url",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "API key",
      key: "has_api_key",
      render: (_: unknown, record: AiModel) =>
        record.has_api_key ? <Tag color="green">Configurada</Tag> : <Tag>Sin configurar</Tag>,
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: unknown, record: AiModel) => (
        <Space>
          <Tooltip title="Editar">
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
          </Tooltip>
          <Tooltip title={record.is_active ? "Desactivar" : "Reactivar"}>
            <Button
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              size="small"
              danger={record.is_active}
              onClick={() => onToggleActive(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Modelos de IA</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          Nuevo modelo
        </Button>
      </div>
      <Table dataSource={models} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </>
  );
}
