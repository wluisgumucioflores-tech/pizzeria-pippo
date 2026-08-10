"use client";

import { Button, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { getCategoryOptions } from "../constants/product.constants";

const { Text } = Typography;

interface Props {
  filterCategory: string | null;
  onFilterCategory: (cat: string | null) => void;
}

export function ProductsCategoryFilters({ filterCategory, onFilterCategory }: Props) {
  const isMobile = useIsMobile();
  const t = useTranslations("products");
  const CATEGORY_OPTIONS = getCategoryOptions(t);

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
      {!isMobile && <Text style={{ lineHeight: "24px" }}>{t("filterLabel")}</Text>}
      <Button size="small" type={!filterCategory ? "primary" : "default"} onClick={() => onFilterCategory(null)}>{t("filterAll")}</Button>
      {CATEGORY_OPTIONS.map((c) => (
        <Button
          key={c.value}
          size="small"
          type={filterCategory === c.value ? "primary" : "default"}
          onClick={() => onFilterCategory(c.value)}
        >
          {c.label}
        </Button>
      ))}
    </div>
  );
}
