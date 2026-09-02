"use client";

import { Table, Button, Space, Tag, Typography, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { AiModel } from "@/features/ai-models/types/aiModel.types";
import type { AiChatPlan } from "../types/aiChatPlan.types";

const { Title, Text } = Typography;

interface Props {
  plans: AiChatPlan[];
  models: AiModel[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (plan: AiChatPlan) => void;
  onToggleActive: (plan: AiChatPlan) => void;
}

export function AiChatPlansTable({ plans, models, loading, onCreate, onEdit, onToggleActive }: Props) {
  const modelLabel = (modelId: string | null) => models.find((m) => m.id === modelId)?.label ?? "Por defecto de la plataforma";

  const columns = [
    {
      title: "Nombre",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: AiChatPlan) => (
        <Space>
          <Text delete={!record.is_active} style={!record.is_active ? { color: "#9ca3af" } : {}}>
            {name}
          </Text>
          {record.is_default && <Tag color="blue">Default</Tag>}
          {!record.is_active && <Tag color="default">Inactivo</Tag>}
        </Space>
      ),
    },
    {
      title: "Mensajes por día",
      dataIndex: "messages_per_day",
      key: "messages_per_day",
      render: (value: number | null) => (value === null ? "Ilimitado" : value),
    },
    {
      title: "Modelo de IA",
      key: "model_id",
      render: (_: unknown, record: AiChatPlan) => <Tag>{modelLabel(record.model_id)}</Tag>,
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: unknown, record: AiChatPlan) => (
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
        <Title level={4} style={{ margin: 0 }}>Planes Chat IA</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          Nuevo plan
        </Button>
      </div>
      <Table dataSource={plans} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </>
  );
}
