"use client";

import { Table, Button, Tag, Switch, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { McpKey } from "../types/mcp-key.types";

const { Text } = Typography;

interface Props {
  keys: McpKey[];
  loading: boolean;
  onCreate: () => void;
  onToggleActive: (key: McpKey) => void;
}

export function McpKeysTable({ keys, loading, onCreate, onToggleActive }: Props) {
  const t = useTranslations("mcp");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>{t("title")}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {t("new")}
        </Button>
      </div>

      <Table
        dataSource={keys}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          {
            title: t("columns.name"),
            dataIndex: "name",
          },
          {
            title: t("columns.lastUsed"),
            dataIndex: "last_used_at",
            render: (lastUsedAt: string | null) =>
              lastUsedAt ? (
                <Text type="secondary">{new Date(lastUsedAt).toLocaleString("es-BO")}</Text>
              ) : (
                <Tag>{t("never")}</Tag>
              ),
          },
          {
            title: t("columns.active"),
            dataIndex: "is_active",
            width: 80,
            render: (_: unknown, row: McpKey) => (
              <Switch checked={row.is_active} size="small" onChange={() => onToggleActive(row)} />
            ),
          },
        ]}
      />
    </div>
  );
}
