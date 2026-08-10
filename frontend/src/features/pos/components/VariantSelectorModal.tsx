"use client";

import { Modal, Button, Tag, Typography, Space } from "antd";
import { useTranslations } from "next-intl";
import { useVariantSelector } from "../hooks/useVariantSelector";
import { PizzaFlavorSelector } from "./PizzaFlavorSelector";
import type { Product, Variant } from "../types/pos.types";
import type { FlavorItem } from "@/lib/promotions";

const { Text } = Typography;

interface Props {
  product: Product | null;
  branchId: string;
  allProducts: Product[];
  getVariantPrice: (variant: Variant, branchId: string) => number;
  getPromoLabel: (variantId: string) => string | null;
  onSelect: (product: Product, variant: Variant, flavors?: FlavorItem[]) => void;
  onClose: () => void;
}

export function VariantSelectorModal({
  product, branchId, allProducts, getVariantPrice, getPromoLabel, onSelect, onClose,
}: Props) {
  const { selectedSize, flavors, totalParts, handleSelectSize, addFlavor, updateParts, removeFlavor } = useVariantSelector(product);
  const t = useTranslations("pos.variantModal");

  if (!product) return null;

  const isPizza = product.category === "pizza";
  const variants = (product.product_variants ?? []).filter((v) => v.is_active !== false);
  const pizzaProducts = allProducts.filter((p) => p.category === "pizza" && p.is_active !== false);

  const selectedVariantIds = new Set(flavors.map((f) => f.variantId));
  const flavorOptions = selectedSize
    ? pizzaProducts.flatMap((p) =>
        p.product_variants
          .filter((v) => v.name === selectedSize.name && v.is_active !== false && !selectedVariantIds.has(v.id))
          .map((v) => ({ value: v.id, label: p.name }))
      )
    : [];

  const handleAddFlavor = (variantId: string) => {
    const p = pizzaProducts.find((p) => p.product_variants.some((v) => v.id === variantId));
    if (p) addFlavor(variantId, p.name);
  };

  const handleConfirm = () => {
    if (!selectedSize) return;
    if (flavors.length === 1) {
      onSelect(product, selectedSize);
      return;
    }
    const flavorItems: FlavorItem[] = flavors.map((f) => ({
      variant_id: f.variantId,
      product_name: f.productName,
      proportion: f.parts / totalParts,
    }));
    onSelect(product, selectedSize, flavorItems);
  };

  if (!isPizza) {
    return (
      <Modal title={product.name} open={!!product} onCancel={onClose} footer={null} width={360} style={{ maxWidth: "calc(100vw - 32px)" }}>
        <div className="flex flex-col gap-3 mt-4">
          {variants.map((variant) => {
            const price = getVariantPrice(variant, branchId);
            const promoLabel = getPromoLabel(variant.id);
            return (
              <Button
                key={variant.id}
                size="large"
                block
                className="flex justify-between items-center h-auto py-3"
                onClick={() => onSelect(product, variant)}
              >
                <Space>
                  <Text strong>{variant.name}</Text>
                  {promoLabel && <Tag color="red">{promoLabel}</Tag>}
                </Space>
                <Text strong className="text-orange-600">Bs {price}</Text>
              </Button>
            );
          })}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={product.name} open={!!product} onCancel={onClose} footer={null} style={{ maxWidth: "calc(100vw - 32px)" }} width={420}>
      <div className="flex flex-col gap-4 mt-4">
        <div>
          <Text type="secondary" className="block mb-2 text-xs uppercase tracking-wide">{t("size")}</Text>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
            {variants.map((variant) => {
              const price = getVariantPrice(variant, branchId);
              const promoLabel = getPromoLabel(variant.id);
              const isSelected = selectedSize?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  onClick={() => handleSelectSize(variant)}
                  className={`rounded-xl border-2 py-3 px-2 flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                    isSelected ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-300"
                  }`}
                >
                  <span className={`font-bold text-sm ${isSelected ? "text-orange-600" : "text-gray-700"}`}>{variant.name}</span>
                  <span className={`text-xs font-semibold ${isSelected ? "text-orange-500" : "text-gray-400"}`}>Bs {price}</span>
                  {promoLabel && <Tag color="red" className="!text-xs !mt-1 !mb-0">{promoLabel}</Tag>}
                </button>
              );
            })}
          </div>
        </div>

        {selectedSize && (
          <PizzaFlavorSelector
            flavors={flavors}
            totalParts={totalParts}
            flavorOptions={flavorOptions}
            onAddFlavor={handleAddFlavor}
            onUpdateParts={updateParts}
            onRemoveFlavor={removeFlavor}
            onConfirm={handleConfirm}
            confirmLabel={
              flavors.length === 1
                ? t("addToCart", { price: getVariantPrice(selectedSize, branchId) })
                : t("addMixedPizza", { price: getVariantPrice(selectedSize, branchId) })
            }
          />
        )}
      </div>
    </Modal>
  );
}
