"use client";

import { Table, Button, Tag, Space, Switch, Typography, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Branch } from "@/features/branches/types/branch.types";
import type { Device } from "../types/device.types";

const { Text } = Typography;

interface Props {
  devices: Device[];
  branches: Branch[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (device: Device) => void;
  onToggleActive: (device: Device) => void;
  onDelete: (device: Device) => void;
}

export function DevicesTable({ devices, branches, loading, onCreate, onEdit, onToggleActive, onDelete }: Props) {
  const t = useTranslations("common");
  const td = useTranslations("devices");
  const branchName = (branchId: string) => branches.find((b) => b.id === branchId)?.name ?? "—";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>{td("title")}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {td("new")}
        </Button>
      </div>

      <Table
        dataSource={devices}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          {
            title: td("columns.name"),
            dataIndex: "name",
          },
          {
            title: td("columns.branch"),
            dataIndex: "branch_id",
            render: (branchId: string) => branchName(branchId),
          },
          {
            title: td("columns.lastSeen"),
            dataIndex: "last_seen_at",
            render: (lastSeenAt: string | null) =>
              lastSeenAt ? (
                <Text type="secondary">{new Date(lastSeenAt).toLocaleString("es-BO")}</Text>
              ) : (
                <Tag>{td("never")}</Tag>
              ),
          },
          {
            title: td("columns.active"),
            dataIndex: "is_active",
            width: 80,
            render: (_: unknown, row: Device) => (
              <Switch checked={row.is_active} size="small" onChange={() => onToggleActive(row)} />
            ),
          },
          {
            title: t("actions"),
            width: 100,
            render: (_: unknown, row: Device) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row)} />
                <Popconfirm
                  title={td("deleteConfirmTitle")}
                  description={td("deleteConfirmDesc")}
                  onConfirm={() => onDelete(row)}
                  okText={t("delete")}
                  cancelText={t("cancel")}
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
