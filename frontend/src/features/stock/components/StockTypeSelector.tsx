"use client";

import { Radio } from "antd";
import { useTranslations } from "next-intl";
import type { StockType } from "../types/stock.types";

interface Props {
  value: StockType;
  onChange: (val: StockType) => void;
}

export function StockTypeSelector({ value, onChange }: Props) {
  const t = useTranslations("stock.typeSelector");

  return (
    <div style={{ marginBottom: 20 }}>
      <Radio.Group
        value={value}
        onChange={(e) => onChange(e.target.value)}
        optionType="button"
        buttonStyle="solid"
      >
        <Radio.Button value="ingredient">{t("ingredients")}</Radio.Button>
        <Radio.Button value="product">{t("products")}</Radio.Button>
      </Radio.Group>
    </div>
  );
}
