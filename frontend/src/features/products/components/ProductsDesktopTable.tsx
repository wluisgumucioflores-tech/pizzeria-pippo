"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { Table, Button, Space, Tag, Typography, Tooltip, Dropdown, Modal } from "antd";
import {
  EditOutlined, StopOutlined, CheckCircleOutlined, DollarOutlined,
  DeleteOutlined, MoreOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCategoryOptions } from "@/features/categories/hooks/useCategoryOptions";
import { ProductImage } from "./ProductImage";
import type { Product } from "../types/product.types";

const { Text } = Typography;

interface Props {
  products: Product[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onToggleActive: (record: Product) => void;
  onDelete: (record: Product) => void;
  onDuplicate: (record: Product) => void;
}

// Detiene la propagación para que los botones de la columna Acciones no
// disparen también el click de la fila (que navega al detalle).
function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}

export function ProductsDesktopTable({ products, loading, page, pageSize, total, onPageChange, onToggleActive, onDelete, onDuplicate }: Props) {
  const router = useRouter();
  const t = useTranslations("common");
  const tp = useTranslations("products");
  const { options: categoryOptions } = useCategoryOptions();
  const categoryLabel = (categoryId: string | null) =>
    categoryOptions.find((c) => c.value === categoryId)?.label ?? "—";

  const confirmDelete = (record: Product) => {
    Modal.confirm({
      title: tp("deleteConfirmTitle"),
      content: tp("deleteConfirmDesc"),
      okText: t("delete"),
      okButtonProps: { danger: true },
      cancelText: t("cancel"),
      onOk: () => onDelete(record),
    });
  };

  const columns = [
    {
      title: tp("columns.image"),
      key: "image_url",
      width: 72,
      render: (_: unknown, record: Product) => <ProductImage url={record.image_url} category={record.category} />,
    },
    {
      title: tp("columns.name"),
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Product) => (
        <Space>
          <Text delete={!record.is_active} style={!record.is_active ? { color: "#9ca3af" } : {}}>
            {name}
          </Text>
          {!record.is_active && <Tag color="default">{tp("inactiveTag")}</Tag>}
        </Space>
      ),
    },
    {
      title: tp("columns.category"),
      dataIndex: "category_id",
      key: "category_id",
      render: (categoryId: string | null) => <Tag>{categoryLabel(categoryId)}</Tag>,
    },
    {
      title: tp("columns.type"),
      dataIndex: "product_type",
      key: "product_type",
      render: (type: string) => (
        <Tag color={type === "resale" ? "purple" : "orange"}>{type === "resale" ? tp("typeResale") : tp("typeMade")}</Tag>
      ),
    },
    {
      title: tp("columns.variants"),
      key: "variants",
      render: (_: unknown, record: Product) => (
        <Space>
          {record.product_variants?.filter((v) => v.is_active).map((v) => <Tag key={v.id}>{v.name}</Tag>)}
        </Space>
      ),
    },
    {
      title: t("actions"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: Product) => (
        <Space onClick={stopRowClick}>
          <Tooltip title={tp("branchPricesTooltip")}>
            <Button icon={<DollarOutlined />} size="small" onClick={() => router.push(`/products/${record.id}/prices`)} />
          </Tooltip>
          <Tooltip title={t("edit")}>
            <Button icon={<EditOutlined />} size="small" onClick={() => router.push(`/products/${record.id}/edit`)} />
          </Tooltip>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "toggle",
                  label: record.is_active ? tp("deactivate") : tp("activate"),
                  icon: record.is_active ? <StopOutlined /> : <CheckCircleOutlined />,
                },
                { type: "divider" },
                { key: "delete", label: t("delete"), icon: <DeleteOutlined />, danger: true },
              ],
              onClick: ({ key }) => {
                if (key === "duplicate") onDuplicate(record);
                else if (key === "toggle") onToggleActive(record);
                else if (key === "delete") confirmDelete(record);
              },
            }}
          >
            <Tooltip title={tp("moreOptionsTooltip")}>
              <Button icon={<MoreOutlined />} size="small" />
            </Tooltip>
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <Table
      dataSource={products}
      columns={columns}
      rowKey="id"
      loading={loading}
      onRow={(record) => ({
        onClick: () => router.push(`/products/${record.id}`),
        style: { cursor: "pointer" },
      })}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: false,
        showTotal: (count) => tp("totalProducts", { count }),
        onChange: onPageChange,
      }}
    />
  );
}
