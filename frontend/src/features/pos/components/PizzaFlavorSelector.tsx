"use client";

import { Button, Typography, Select } from "antd";
import { PlusOutlined, MinusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { FlavorEntry } from "../hooks/useVariantSelector";

const { Text } = Typography;

interface Props {
  flavors: FlavorEntry[];
  totalParts: number;
  flavorOptions: { value: string; label: string }[];
  onAddFlavor: (variantId: string) => void;
  onUpdateParts: (idx: number, delta: number) => void;
  onRemoveFlavor: (idx: number) => void;
  onConfirm: () => void;
  confirmLabel: string;
}

export function PizzaFlavorSelector({
  flavors, totalParts, flavorOptions, onAddFlavor, onUpdateParts, onRemoveFlavor, onConfirm, confirmLabel,
}: Props) {
  const t = useTranslations("pos.flavors");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <Text type="secondary" className="text-xs uppercase tracking-wide">{t("title")}</Text>
        <Text type="secondary" className="text-xs">
          {t("totalParts", { count: totalParts })}
        </Text>
      </div>

      {flavors.map((flavor, idx) => {
        const fraction = `${flavor.parts}/${totalParts}`;
        const barWidth = Math.round((flavor.parts / totalParts) * 100);
        return (
          <div key={flavor.variantId} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <Text strong className="text-sm">{flavor.productName}</Text>
              <div className="flex items-center gap-2">
                <Text type="secondary" className="text-xs w-8 text-right">{fraction}</Text>
                {flavors.length > 1 && (
                  <button onClick={() => onRemoveFlavor(idx)} className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                    <DeleteOutlined style={{ fontSize: 13 }} />
                  </button>
                )}
              </div>
            </div>

            <div className="h-1.5 bg-gray-200 rounded-full mb-3">
              <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onUpdateParts(idx, -1)}
                disabled={flavor.parts <= 1}
                className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <MinusOutlined style={{ fontSize: 11 }} />
              </button>
              <span className="text-base font-bold text-gray-800 w-4 text-center">{flavor.parts}</span>
              <button
                onClick={() => onUpdateParts(idx, 1)}
                className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <PlusOutlined style={{ fontSize: 11 }} />
              </button>
              <Text type="secondary" className="text-xs ml-1">
                {t("partsCount", { count: flavor.parts })}
              </Text>
            </div>
          </div>
        );
      })}

      {flavorOptions.length > 0 && (
        <Select
          placeholder={t("addAnother")}
          value={undefined}
          onChange={(val: string) => onAddFlavor(val)}
          options={flavorOptions}
          className="w-full"
          suffixIcon={<PlusOutlined />}
        />
      )}

      <Button type="primary" size="large" block onClick={onConfirm} style={{ backgroundColor: "#ea580c", borderColor: "#ea580c" }}>
        {confirmLabel}
      </Button>
    </div>
  );
}
