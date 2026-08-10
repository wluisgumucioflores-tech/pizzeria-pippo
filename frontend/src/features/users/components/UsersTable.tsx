"use client";

import { Table, Button, Space, Tag, Typography, Popconfirm, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { ROLE_COLORS, getRoleLabels } from "../constants/user.constants";
import { useIsMobile } from "@/lib/useIsMobile";
import type { User, Branch } from "../types/user.types";

const { Title, Text } = Typography;

interface Props {
  users: User[];
  branches: Branch[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (user: User) => void;
  onToggleBan: (user: User) => void;
  onDelete: (id: string) => void;
}

export function UsersTable({ users, branches, loading, onCreate, onEdit, onToggleBan, onDelete }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("common");
  const tu = useTranslations("users");
  const roleLabels = getRoleLabels(tu);
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.name ?? "—") : "—";

  const renderActions = (record: User) => (
    <Space size={4}>
      <Tooltip title={t("edit")}>
        <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
      </Tooltip>

      <Tooltip title={record.is_banned ? tu("reactivate") : tu("deactivate")}>
        <Popconfirm
          title={record.is_banned ? tu("reactivateConfirmTitle") : tu("deactivateConfirmTitle")}
          description={record.is_banned
            ? tu("reactivateDesc")
            : tu("deactivateDesc")}
          onConfirm={() => onToggleBan(record)}
          okText={record.is_banned ? tu("reactivate") : tu("deactivate")}
          cancelText={t("cancel")}
          okButtonProps={{ danger: !record.is_banned }}
        >
          <Button
            icon={record.is_banned ? <CheckCircleOutlined /> : <StopOutlined />}
            size="small"
            danger={!record.is_banned}
          />
        </Popconfirm>
      </Tooltip>

      <Tooltip title={record.has_orders ? tu("deleteBlockedTooltip") : tu("deleteTooltip")}>
        <Popconfirm
          title={tu("deleteConfirmTitle")}
          description={tu("deleteConfirmDesc")}
          onConfirm={() => onDelete(record.id)}
          okText={t("delete")}
          cancelText={t("cancel")}
          okButtonProps={{ danger: true }}
          disabled={record.has_orders}
        >
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            disabled={record.has_orders}
          />
        </Popconfirm>
      </Tooltip>
    </Space>
  );

  const columns = [
    {
      title: tu("columns.name"),
      dataIndex: "full_name",
      key: "full_name",
      sorter: (a: User, b: User) => a.full_name.localeCompare(b.full_name),
      render: (name: string, record: User) => (
        <Space>
          <Text delete={record.is_banned} style={record.is_banned ? { color: "#9ca3af" } : {}}>
            {name || "—"}
          </Text>
          {record.is_banned && <Tag color="default">{tu("inactiveTag")}</Tag>}
        </Space>
      ),
    },
    { title: tu("columns.email"), dataIndex: "email", key: "email" },
    {
      title: tu("columns.role"),
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role] ?? "default"}>{roleLabels[role] ?? role}</Tag>
      ),
    },
    {
      title: tu("columns.branch"),
      dataIndex: "branch_id",
      key: "branch_id",
      render: (id: string | null) => branchName(id),
    },
    {
      title: tu("columns.createdAt"),
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) =>
        new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    },
    {
      title: t("actions"),
      key: "actions",
      width: 130,
      render: (_: unknown, record: User) => renderActions(record),
    },
  ];

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
      <Title level={4} style={{ margin: 0 }}>{tu("title")}</Title>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        {isMobile ? tu("newShort") : tu("new")}
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
            {users.map((user) => (
              <div
                key={user.id}
                style={{
                  background: user.is_banned ? "#f9fafb" : "#fff",
                  border: `1px solid ${user.is_banned ? "#d1d5db" : "#e5e7eb"}`,
                  borderRadius: 10,
                  padding: 14,
                  opacity: user.is_banned ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Space>
                      <Text strong style={{ fontSize: 15, textDecoration: user.is_banned ? "line-through" : "none", color: user.is_banned ? "#9ca3af" : undefined }}>
                        {user.full_name || "—"}
                      </Text>
                      {user.is_banned && <Tag color="default" style={{ margin: 0 }}>{tu("inactiveTag")}</Tag>}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.email}
                    </Text>
                    <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Tag color={ROLE_COLORS[user.role] ?? "default"} style={{ margin: 0 }}>
                        {roleLabels[user.role] ?? user.role}
                      </Tag>
                      {user.branch_id && (
                        <Tag style={{ margin: 0 }}>{branchName(user.branch_id)}</Tag>
                      )}
                    </div>
                  </div>
                  {renderActions(user)}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
    </>
  );
}
