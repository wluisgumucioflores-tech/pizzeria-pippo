"use client";

import { Table, Button, Space, Tag, Typography, Tooltip, Switch, Pagination, Input } from "antd";
import {
  PlusOutlined, EditOutlined, StopOutlined,
  CheckCircleOutlined, EyeOutlined, SearchOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { getUnitOptions, UNIT_COLORS } from "../constants/ingredient.constants";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Ingredient } from "../types/ingredient.types";

const { Title, Text } = Typography;

interface Props {
  ingredients: Ingredient[];
  loading: boolean;
  showInactive: boolean;
  onToggleInactive: (val: boolean) => void;
  search: string;
  onSearch: (val: string) => void;
  onCreate: () => void;
  onEdit: (ingredient: Ingredient) => void;
  onToggleActive: (ingredient: Ingredient) => void;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function IngredientsTable({ ingredients, loading, showInactive, onToggleInactive, search, onSearch, onCreate, onEdit, onToggleActive, page, total, pageSize, onPageChange }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("common");
  const ti = useTranslations("ingredients");
  const UNIT_OPTIONS = getUnitOptions(ti);

  const columns = [
    {
      title: ti("name"),
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Ingredient) => (
        <Space>
          <Text delete={!record.is_active} style={!record.is_active ? { color: "#9ca3af" } : {}}>
            {name}
          </Text>
          {!record.is_active && <Tag color="default">{ti("inactiveTag")}</Tag>}
        </Space>
      ),
    },
    {
      title: ti("unit"),
      dataIndex: "unit",
      key: "unit",
      render: (unit: string, record: Ingredient) => (
        <Tag color={record.is_active ? (UNIT_COLORS[unit] ?? "default") : "default"}>
          {UNIT_OPTIONS.find((u) => u.value === unit)?.label ?? unit}
        </Tag>
      ),
    },
    {
      title: t("actions"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: Ingredient) => (
        <Space>
          <Tooltip title={t("edit")}>
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
          </Tooltip>
          <Tooltip title={record.is_active ? ti("deactivate") : ti("reactivate")}>
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

  const header = (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>{ti("title")}</Title>
        <Space wrap>
          <Space size={4}>
            <EyeOutlined style={{ color: "#6b7280" }} />
            {!isMobile && <Text type="secondary">{ti("showInactive")}</Text>}
            <Switch size="small" checked={showInactive} onChange={onToggleInactive} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {isMobile ? ti("newShort") : ti("new")}
          </Button>
        </Space>
      </div>
      <Input
        placeholder={ti("searchPlaceholder")}
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        allowClear
        style={{ width: isMobile ? "100%" : 260 }}
      />
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
            {ingredients.map((ingredient) => (
              <div
                key={ingredient.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  opacity: ingredient.is_active ? 1 : 0.6,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    strong
                    style={{
                      fontSize: 15,
                      display: "block",
                      textDecoration: ingredient.is_active ? "none" : "line-through",
                      color: ingredient.is_active ? undefined : "#9ca3af",
                    }}
                  >
                    {ingredient.name}
                  </Text>
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <Tag
                      color={ingredient.is_active ? (UNIT_COLORS[ingredient.unit] ?? "default") : "default"}
                      style={{ margin: 0 }}
                    >
                      {UNIT_OPTIONS.find((u) => u.value === ingredient.unit)?.label ?? ingredient.unit}
                    </Tag>
                    {!ingredient.is_active && <Tag color="default" style={{ margin: 0 }}>{ti("inactiveTag")}</Tag>}
                  </div>
                </div>
                <Space size={6}>
                  <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(ingredient)} />
                  <Button
                    icon={ingredient.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                    size="small"
                    danger={ingredient.is_active}
                    onClick={() => onToggleActive(ingredient)}
                  />
                </Space>
              </div>
            ))}
            {total > pageSize && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showTotal={(count) => ti("totalIngredients", { count })}
                  onChange={onPageChange}
                  showSizeChanger={false}
                  size="small"
                />
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <Table
        dataSource={ingredients}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (count) => ti("totalIngredients", { count }),
          onChange: onPageChange,
          showSizeChanger: false,
        }}
        rowClassName={(r) => (!r.is_active ? "opacity-60" : "")}
      />
    </>
  );
}
