"use client";

import { Table, Button, Space, Tag, Typography, Tooltip, Switch, Popconfirm } from "antd";
import {
  PlusOutlined, EditOutlined, StopOutlined,
  CheckCircleOutlined, EyeOutlined, DeleteOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Branch } from "../types/branch.types";

const { Title, Text } = Typography;

interface Props {
  branches: Branch[];
  loading: boolean;
  showInactive: boolean;
  onToggleInactive: (val: boolean) => void;
  onCreate: () => void;
  onEdit: (branch: Branch) => void;
  onToggleActive: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
}

export function BranchesTable({ branches, loading, showInactive, onToggleInactive, onCreate, onEdit, onToggleActive, onDelete }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("common");
  const tb = useTranslations("branches");

  const columns = [
    {
      title: tb("columns.name"),
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Branch) => (
        <Space>
          <Text delete={!record.is_active} style={!record.is_active ? { color: "#9ca3af" } : {}}>
            {name}
          </Text>
          {!record.is_active && <Tag color="default">{tb("inactiveTag")}</Tag>}
        </Space>
      ),
    },
    {
      title: tb("columns.address"),
      dataIndex: "address",
      key: "address",
      render: (address: string | null, record: Branch) => (
        <Text style={!record.is_active ? { color: "#9ca3af" } : {}}>{address ?? "—"}</Text>
      ),
    },
    {
      title: tb("columns.createdAt"),
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string, record: Branch) => (
        <Text style={!record.is_active ? { color: "#9ca3af" } : {}}>
          {new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </Text>
      ),
    },
    {
      title: t("actions"),
      key: "actions",
      width: 160,
      render: (_: unknown, record: Branch) => (
        <Space>
          <Tooltip title={t("edit")}>
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
          </Tooltip>
          <Tooltip title={record.is_active ? tb("deactivate") : tb("reactivate")}>
            <Button
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              size="small"
              danger={record.is_active}
              onClick={() => onToggleActive(record)}
            />
          </Tooltip>
          <Popconfirm
            title={tb("deleteConfirmTitle")}
            description={tb("deleteConfirmDescLong")}
            onConfirm={() => onDelete(record)}
            okText={t("delete")}
            cancelText={t("cancel")}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t("delete")}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
      <Title level={4} style={{ margin: 0 }}>{tb("title")}</Title>
      <Space wrap>
        <Space size={4}>
          <EyeOutlined style={{ color: "#6b7280" }} />
          {!isMobile && <Text type="secondary">{tb("showInactive")}</Text>}
          <Switch size="small" checked={showInactive} onChange={onToggleInactive} />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {isMobile ? tb("newShort") : tb("new")}
        </Button>
      </Space>
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
            {branches.map((branch) => (
              <div
                key={branch.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 14,
                  opacity: branch.is_active ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text
                        strong
                        style={{ fontSize: 15, textDecoration: branch.is_active ? "none" : "line-through", color: branch.is_active ? undefined : "#9ca3af" }}
                      >
                        {branch.name}
                      </Text>
                      {!branch.is_active && <Tag color="default" style={{ margin: 0 }}>{tb("inactiveTag")}</Tag>}
                    </div>
                    {branch.address && (
                      <Text type="secondary" style={{ fontSize: 13, display: "block", marginTop: 2 }}>{branch.address}</Text>
                    )}
                  </div>
                  <Space size={6}>
                    <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(branch)} />
                    <Button
                      icon={branch.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                      size="small"
                      danger={branch.is_active}
                      onClick={() => onToggleActive(branch)}
                    />
                    <Popconfirm
                      title={tb("deleteConfirmTitle")}
                      description={tb("deleteConfirmDescShort")}
                      onConfirm={() => onDelete(branch)}
                      okText={t("delete")}
                      cancelText={t("cancel")}
                      okButtonProps={{ danger: true }}
                    >
                      <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                  </Space>
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
      <Table
        dataSource={branches}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        rowClassName={(r) => (!r.is_active ? "opacity-60" : "")}
      />
    </>
  );
}
