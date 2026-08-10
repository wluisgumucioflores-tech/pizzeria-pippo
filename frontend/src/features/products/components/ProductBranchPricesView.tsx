"use client";

import { Tabs, Typography, Skeleton } from "antd";
import { useTranslations } from "next-intl";
import { BranchPricesTable } from "./BranchPricesTable";
import type { VariantWithPrices, Branch } from "../types/product.types";

const { Text } = Typography;

interface Props {
  productName: string;
  variants: VariantWithPrices[];
  branches: Branch[];
  isLoading: boolean;
  saving: boolean;
  onSave: (variantId: string, branchId: string, price: number) => Promise<void>;
}

export function ProductBranchPricesView({ productName, variants, branches, isLoading, saving, onSave }: Props) {
  const t = useTranslations("products.branchPricesPage");
  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;

  if (variants.length === 1 && variants[0].name === "Unidad") {
    return (
      <div>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          {t("resaleSingleNote")}
        </Text>
        <BranchPricesTable variant={variants[0]} branches={branches} saving={saving} onSave={onSave} />
      </div>
    );
  }

  const tabItems = variants.map((variant) => ({
    key: variant.id,
    label: variant.name,
    children: <BranchPricesTable variant={variant} branches={branches} saving={saving} onSave={onSave} />,
  }));

  return (
    <div>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        {t("variantNote", { name: productName })}
      </Text>
      <Tabs items={tabItems} />
    </div>
  );
}
