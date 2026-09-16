"use client";

import { Table, Button, Typography, Space, Tag, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { Announcement } from "../types/announcement.types";

const { Title, Text } = Typography;

interface Props {
  announcements: Announcement[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (record: Announcement) => void;
  onDelete: (record: Announcement) => void;
}

export function AnnouncementsTable({ announcements, loading, onCreate, onEdit, onDelete }: Props) {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-5">
        <Title level={4} style={{ margin: 0 }}>Banners</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          Nuevo banner
        </Button>
      </div>
      <Table
        rowKey="business_id"
        loading={loading}
        dataSource={announcements}
        columns={[
          { title: "Negocio", dataIndex: "business_name", width: 220 },
          {
            title: "Mensaje",
            dataIndex: "message",
            render: (message: string) => (
              <Text style={{ maxWidth: 420, display: "inline-block" }} ellipsis={{ tooltip: message }}>
                {message}
              </Text>
            ),
          },
          {
            title: "Estado",
            dataIndex: "is_active",
            width: 110,
            render: (isActive: boolean) => <Tag color={isActive ? "green" : "default"}>{isActive ? "Activo" : "Inactivo"}</Tag>,
          },
          {
            title: "Actualizado",
            dataIndex: "updated_at",
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "Acciones",
            key: "actions",
            width: 100,
            render: (_: unknown, row: Announcement) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row)} />
                <Popconfirm
                  title="¿Eliminar este banner?"
                  onConfirm={() => onDelete(row)}
                  okText="Eliminar"
                  cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
