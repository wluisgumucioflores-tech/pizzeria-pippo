"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { Button, Tag, Typography, Dropdown, Modal, Tooltip } from "antd";
import {
  EditOutlined, StopOutlined, CheckCircleOutlined, DollarOutlined,
  DeleteOutlined, CopyOutlined, MoreOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { getCategoryOptions, CATEGORY_COLORS } from "../constants/product.constants";
import { ProductImage } from "./ProductImage";
import type { Product } from "../types/product.types";

const { Text } = Typography;

interface Props {
  products: Product[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onToggleActive: (record: Product) => void;
  onDelete: (record: Product) => void;
  onDuplicate: (record: Product) => void;
}

function stopCardClick(e: MouseEvent) {
  e.stopPropagation();
}

export function ProductsMobileList({ products, loading, total, page, pageSize, onPageChange, onToggleActive, onDelete, onDuplicate }: Props) {
  const router = useRouter();
  const t = useTranslations("common");
  const tp = useTranslations("products");
  const CATEGORY_OPTIONS = getCategoryOptions(tp);

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

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>{t("loading")}</div>;
  }

  return (
    <>
      <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 13 }}>{tp("totalProducts", { count: total })}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => router.push(`/products/${product.id}`)}
            style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, opacity: product.is_active ? 1 : 0.6, cursor: "pointer" }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <ProductImage url={product.image_url} category={product.category} width={56} height={56} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text strong style={{ fontSize: 15, textDecoration: product.is_active ? "none" : "line-through" }}>
                    {product.name}
                  </Text>
                  {!product.is_active && <Tag color="default" style={{ margin: 0 }}>{tp("inactiveTag")}</Tag>}
                </div>
                <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <Tag color={product.category ? CATEGORY_COLORS[product.category] : "default"} style={{ margin: 0 }}>
                    {product.category ? (CATEGORY_OPTIONS.find((c) => c.value === product.category)?.label ?? product.category) : "—"}
                  </Tag>
                  <Tag color={product.product_type === "resale" ? "purple" : "orange"} style={{ margin: 0 }}>
                    {product.product_type === "resale" ? tp("typeResale") : tp("typeMade")}
                  </Tag>
                  {product.product_variants?.filter((v) => v.is_active).map((v) => (
                    <Tag key={v.id} style={{ margin: 0 }}>{v.name}</Tag>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, borderTop: "1px solid #f3f4f6", paddingTop: 10 }} onClick={stopCardClick}>
              <Tooltip title={tp("branchPricesTooltip")}>
                <Button size="small" icon={<DollarOutlined />} onClick={() => router.push(`/products/${product.id}/prices`)} style={{ flex: 1 }} />
              </Tooltip>
              <Tooltip title={t("edit")}>
                <Button size="small" icon={<EditOutlined />} onClick={() => router.push(`/products/${product.id}/edit`)} style={{ flex: 1 }} />
              </Tooltip>
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: "duplicate", label: tp("duplicate"), icon: <CopyOutlined /> },
                    {
                      key: "toggle",
                      label: product.is_active ? tp("deactivate") : tp("activate"),
                      icon: product.is_active ? <StopOutlined /> : <CheckCircleOutlined />,
                    },
                    { type: "divider" },
                    { key: "delete", label: t("delete"), icon: <DeleteOutlined />, danger: true },
                  ],
                  onClick: ({ key }) => {
                    if (key === "duplicate") onDuplicate(product);
                    else if (key === "toggle") onToggleActive(product);
                    else if (key === "delete") confirmDelete(product);
                  },
                }}
              >
                <Tooltip title={tp("moreOptionsTooltip")}>
                  <Button size="small" icon={<MoreOutlined />} style={{ flex: 1 }} />
                </Tooltip>
              </Dropdown>
            </div>
          </div>
        ))}
      </div>
      {total > pageSize && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <Button size="small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{tp("previous")}</Button>
          <span style={{ lineHeight: "24px", color: "#6b7280", fontSize: 13 }}>{tp("pageOf", { page, total: Math.ceil(total / pageSize) })}</span>
          <Button size="small" disabled={page >= Math.ceil(total / pageSize)} onClick={() => onPageChange(page + 1)}>{tp("next")}</Button>
        </div>
      )}
    </>
  );
}
