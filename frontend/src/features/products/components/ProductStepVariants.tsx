"use client";

import { Button, Select, InputNumber, Typography, Switch } from "antd";
import type { FocusEvent } from "react";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { VariantBranchPrices } from "./VariantBranchPrices";
import type { Variant, VariantTypeOption, Branch } from "../types/product.types";

// Selecciona todo el texto al enfocar: sin esto, escribir sobre un campo en 0
// inserta el dígito antes del 0 (ej. tipear "5" deja "05") en vez de reemplazarlo.
function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}

const { Text } = Typography;

interface Props {
  variants: Variant[];
  variantTypeOptions: VariantTypeOption[];
  branches: Branch[];
  hasVariants: boolean;
  onToggleVariants: (val: boolean) => void;
  onUpdateVariant: (index: number, field: keyof Variant, value: unknown) => void;
  onUpdateVariantBranchPrice: (index: number, branchId: string, price: number) => void;
  onAddVariant: () => void;
  onRemoveVariant: (index: number) => void;
  onReactivateVariant: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  nextLabel?: string;
  saving?: boolean;
}

export function ProductStepVariants({
  variants, variantTypeOptions, branches,
  hasVariants, onToggleVariants,
  onUpdateVariant, onUpdateVariantBranchPrice,
  onAddVariant, onRemoveVariant, onReactivateVariant,
  onPrev, onNext, nextLabel, saving,
}: Props) {
  const simpleVariant = variants[0];
  const tf = useTranslations("products.form");
  const tv = useTranslations("products.variants");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <Switch checked={hasVariants} onChange={onToggleVariants} />
        <div>
          <Text strong style={{ fontSize: 14 }}>{tf("hasVariantsLabel")}</Text>
          <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
            {hasVariants ? tf("hasVariantsHintOn") : tf("hasVariantsHintOff")}
          </Text>
        </div>
      </div>

      {!hasVariants && simpleVariant && (
        <div style={{ padding: "16px 20px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Text type="secondary" style={{ whiteSpace: "nowrap" }}>{tv("basePrice")}</Text>
            <InputNumber
              prefix="Bs"
              value={simpleVariant.base_price}
              onChange={(val) => onUpdateVariant(0, "base_price", val ?? 0)}
              onFocus={selectOnFocus}
              style={{ width: 160 }}
              min={0}
            />
          </div>
          <VariantBranchPrices
            branches={branches}
            basePrice={simpleVariant.base_price}
            branchPrices={simpleVariant.branch_prices}
            onChange={(branchId, price) => onUpdateVariantBranchPrice(0, branchId, price)}
          />
        </div>
      )}

      {hasVariants && (
        <>
          {variantTypeOptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {tf("noVariantTypes")}
            </div>
          ) : (
            <>
              {/* Variants as horizontal cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 12 }}>
                {variants.map((variant, vi) => {
                  const inactive = variant.is_active === false;
                  const activeCount = variants.filter((v) => v.is_active !== false).length;
                  return (
                    <div
                      key={vi}
                      style={{ padding: "14px 16px", background: inactive ? "#fafafa" : "#f9fafb", borderRadius: 10, border: `1px solid ${inactive ? "#e5e7eb" : "#e5e7eb"}`, position: "relative", opacity: inactive ? 0.6 : 1 }}
                    >
                      {inactive ? (
                        <button
                          onClick={() => onReactivateVariant(vi)}
                          style={{ position: "absolute", top: 8, right: 8, background: "none", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 11, color: "#6b7280", padding: "2px 8px" }}
                        >
                          {tf("reactivate")}
                        </button>
                      ) : (
                        activeCount > 1 && (
                          <button
                            onClick={() => onRemoveVariant(vi)}
                            style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                          >
                            <MinusCircleOutlined style={{ fontSize: 14 }} />
                          </button>
                        )
                      )}
                      <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{tf("sizeLabel")}</Text>
                      <Select
                        value={variant.name}
                        options={variantTypeOptions.filter(
                          (o) => o.value === variant.name || !variants.some((v, i) => i !== vi && v.name === o.value)
                        )}
                        onChange={(val) => onUpdateVariant(vi, "name", val)}
                        style={{ width: "100%", marginTop: 4, marginBottom: 10 }}
                        disabled={inactive}
                      />
                      <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{tv("basePrice")}</Text>
                      <InputNumber
                        prefix="Bs"
                        value={variant.base_price}
                        onChange={(val) => onUpdateVariant(vi, "base_price", val ?? 0)}
                        onFocus={selectOnFocus}
                        style={{ width: "100%", marginTop: 4 }}
                        min={0}
                        disabled={inactive}
                      />
                      {!inactive && (
                        <VariantBranchPrices
                          branches={branches}
                          basePrice={variant.base_price}
                          branchPrices={variant.branch_prices}
                          onChange={(branchId, price) => onUpdateVariantBranchPrice(vi, branchId, price)}
                        />
                      )}
                    </div>
                  );
                })}

                {variants.filter((v) => v.is_active !== false).length < variantTypeOptions.length && (
                  <button
                    onClick={onAddVariant}
                    style={{ padding: "14px 16px", borderRadius: 10, border: "2px dashed #d1d5db", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#6b7280", minHeight: 120 }}
                  >
                    <PlusOutlined style={{ fontSize: 20 }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>{tf("addVariant")}</Text>
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      <div className="flex justify-between mt-4">
        <Button onClick={onPrev}>{tf("previous")}</Button>
        <Button type="primary" onClick={onNext} disabled={variants.length === 0} loading={saving}>
          {nextLabel ?? tf("next")}
        </Button>
      </div>
    </div>
  );
}
