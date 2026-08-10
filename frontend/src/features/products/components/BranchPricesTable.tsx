"use client";

import { Table, Typography, Tag } from "antd";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { PriceCell } from "./PriceCell";
import type { VariantWithPrices, Branch } from "../types/product.types";

const { Text } = Typography;

interface Props {
  variant: VariantWithPrices;
  branches: Branch[];
  saving: boolean;
  onSave: (variantId: string, branchId: string, price: number) => Promise<void>;
}

export function BranchPricesTable({ variant, branches, saving, onSave }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("products.branchPricesTable");

  const rows = branches.map((branch) => {
    const bp = variant.branch_prices.find((p) => p.branch_id === branch.id);
    return { branchId: branch.id, branchName: branch.name, price: bp?.price };
  });

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row) => (
          <div key={row.branchId} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text strong style={{ fontSize: 14 }}>{row.branchName}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t("baseLabel", { price: Number(variant.base_price).toFixed(2) })}
              </Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                {row.price !== undefined ? (
                  <Tag color="orange" style={{ fontSize: 13 }}>Bs {Number(row.price).toFixed(2)}</Tag>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>{t("noPriceAssigned")}</Text>
                )}
              </div>
              <PriceCell variantId={variant.id} branchId={row.branchId} price={row.price} saving={saving} onSave={onSave} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const columns = [
    {
      title: t("branch"),
      key: "branch",
      render: (_: unknown, row: typeof rows[0]) => <Text>{row.branchName}</Text>,
    },
    {
      title: t("basePrice"),
      key: "base_price",
      render: () => <Text type="secondary">Bs {Number(variant.base_price).toFixed(2)}</Text>,
    },
    {
      title: t("branchPrice"),
      key: "price",
      render: (_: unknown, row: typeof rows[0]) => (
        row.price !== undefined
          ? <Tag color="orange">Bs {Number(row.price).toFixed(2)}</Tag>
          : <Text type="secondary">—</Text>
      ),
    },
    {
      title: t("action"),
      key: "action",
      render: (_: unknown, row: typeof rows[0]) => (
        <PriceCell variantId={variant.id} branchId={row.branchId} price={row.price} saving={saving} onSave={onSave} />
      ),
    },
  ];

  return <Table dataSource={rows} columns={columns} rowKey="branchId" pagination={false} size="small" />;
}
