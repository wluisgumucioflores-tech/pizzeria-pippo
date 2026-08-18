"use client";

import { Table, Button, Tag, Space, Typography, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { Category } from "../types/category.types";

interface Props {
  categories: Category[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoriesTable({ categories, loading, onCreate, onEdit, onDelete }: Props) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>Categorías</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          Nueva categoría
        </Button>
      </div>

      <Table
        dataSource={categories}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: "Nombre", dataIndex: "name" },
          {
            title: "Por defecto",
            dataIndex: "is_pizza",
            width: 120,
            render: (isPizza: boolean) => (isPizza ? <Tag color="orange">Sí</Tag> : null),
          },
          {
            title: "Acciones",
            width: 100,
            render: (_: unknown, row: Category) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row)} />
                <Popconfirm
                  title="¿Eliminar esta categoría?"
                  description="No se puede si hay productos asignados a ella."
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
