"use client";

import { Modal } from "antd";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Promotion, CartItem } from "@/lib/promotions";
import type { Product, Variant } from "../types/pos.types";
import { usePromoComboSelection } from "../hooks/usePromoComboSelection";
import { PromoComboSlot } from "./PromoComboSlot";
import { PromoComboSummaryPanel } from "./PromoComboSummaryPanel";

interface Props {
  promo: Promotion | null;
  products: Product[];
  branchId: string;
  getVariantPrice: (variant: Variant, branchId: string) => number;
  onConfirm: (items: CartItem[]) => void;
  onClose: () => void;
}

export function PromoComboModal({ promo, products, branchId, getVariantPrice, onConfirm, onClose }: Props) {
  const isMobile = useIsMobile();
  const {
    rules, selections, showFlavors, allFilled,
    selectOption, setFlavorEntries, revealFlavorBuilder, buildCartItems,
  } = usePromoComboSelection(promo, products, branchId, getVariantPrice);

  if (!promo) return null;

  const comboPrice = rules[0]?.combo_price ?? 0;

  const handleConfirm = () => {
    onConfirm(buildCartItems());
    onClose();
  };

  return (
    <Modal
      centered
      title={<span>🎁 {promo.name}</span>}
      open={!!promo}
      onCancel={onClose}
      footer={null}
      width={isMobile ? "100%" : 820}
      style={{ maxWidth: "calc(100vw - 32px)", top: isMobile ? 16 : 24 }}
      destroyOnHidden
    >
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : (rules.length > 1 ? "1fr 1fr" : "1fr"), gap: 12, minWidth: 0 }}>
          {rules.map((rule, idx) => (
            <PromoComboSlot
              key={idx}
              rule={rule}
              idx={idx}
              products={products}
              branchId={branchId}
              getVariantPrice={getVariantPrice}
              selected={selections[idx] ?? null}
              showFlavorBuilder={showFlavors.has(idx)}
              onSelect={selectOption}
              onRevealFlavorBuilder={revealFlavorBuilder}
              onFlavorChange={setFlavorEntries}
            />
          ))}
        </div>

        <PromoComboSummaryPanel
          comboPrice={comboPrice}
          rules={rules}
          selections={selections}
          allFilled={allFilled}
          isMobile={isMobile}
          onConfirm={handleConfirm}
        />
      </div>
    </Modal>
  );
}
