"use client";

import { Table, Button, Tag, Space, Popconfirm, Switch, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { AuthorizedChat } from "@/features/telegram-bot/types";
import { UsageIndicator } from "./UsageIndicator";

const { Text } = Typography;

const PLAN_COLORS: Record<string, string> = {
  basic: "default",
  pro: "blue",
  unlimited: "gold",
};

interface Props {
  chats: AuthorizedChat[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (chat: AuthorizedChat) => void;
  onToggleActive: (chat: AuthorizedChat) => void;
  onDelete: (id: string) => void;
}

export function AuthorizedChatsTable({ chats, loading, onCreate, onEdit, onToggleActive, onDelete }: Props) {
  const t = useTranslations("common");
  const tc = useTranslations("settings.chats");
  const planLabels: Record<string, string> = {
    basic: tc("planBasic"),
    pro: tc("planPro"),
    unlimited: tc("planUnlimited"),
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>{tc("title")}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {tc("add")}
        </Button>
      </div>

      <Table
        dataSource={chats}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          {
            title: tc("columns.name"),
            dataIndex: "label",
            render: (label: string, row: AuthorizedChat) => (
              <div>
                <div>{label}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{row.chat_id}</Text>
              </div>
            ),
          },
          {
            title: tc("columns.type"),
            dataIndex: "type",
            width: 90,
            render: (type: string) => (
              <Tag>{type === "group" ? tc("typeGroup") : tc("typePersonal")}</Tag>
            ),
          },
          {
            title: tc("columns.plan"),
            dataIndex: "plan",
            width: 110,
            render: (plan: string) => (
              <Tag color={PLAN_COLORS[plan]}>{planLabels[plan]}</Tag>
            ),
          },
          {
            title: tc("columns.usageToday"),
            width: 110,
            render: (_: unknown, row: AuthorizedChat) => <UsageIndicator chat={row} />,
          },
          {
            title: tc("columns.active"),
            dataIndex: "is_active",
            width: 80,
            render: (_: unknown, row: AuthorizedChat) => (
              <Switch checked={row.is_active} size="small" onChange={() => onToggleActive(row)} />
            ),
          },
          {
            title: t("actions"),
            width: 100,
            render: (_: unknown, row: AuthorizedChat) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row)} />
                <Popconfirm
                  title={tc("revokeConfirm")}
                  onConfirm={() => onDelete(row.id)}
                  okText={tc("revoke")}
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
