"use client";

import { Input, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { PosOrderTypeOption } from "@pippo/shared";
import { OptionCard } from "./OptionCard";

const { Text } = Typography;

const EMOJI: Record<PosOrderTypeOption, string> = {
  dine_in: "🍽️",
  takeaway: "🥡",
  delivery: "🛵",
};

const LABEL_KEY: Record<PosOrderTypeOption, string> = {
  dine_in: "orderType.dineIn",
  takeaway: "orderType.takeaway",
  delivery: "orderType.delivery",
};

interface Props {
  options: PosOrderTypeOption[];
  selected: PosOrderTypeOption | null;
  disabled: boolean;
  enableTableNumber: boolean;
  tableNumber: string;
  onSelect: (type: PosOrderTypeOption) => void;
  onTableNumberChange: (value: string) => void;
}

export function OrderTypeSection({
  options, selected, disabled, enableTableNumber, tableNumber, onSelect, onTableNumberChange,
}: Props) {
  const t = useTranslations("pos");
  const tm = useTranslations("pos.paymentModal");

  const tableField = enableTableNumber && selected === "dine_in" && (
    <Input
      value={tableNumber}
      onChange={(e) => onTableNumberChange(e.target.value)}
      placeholder={tm("tableNumberPlaceholder")}
      className="mt-2"
    />
  );

  // Con un solo tipo habilitado no hay decisión que tomar y la sección entera
  // sobra. Un tipo preseleccionado entre varios NO esconde nada: viene marcado
  // pero el cajero tiene que poder cambiarlo.
  if (options.length <= 1) return tableField || null;

  return (
    <div style={disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{ width: 4, height: 16, background: "#ea580c", borderRadius: 2 }} />
        <Text strong>{tm("howIsOrder")} <Text type="danger">*</Text></Text>
      </div>
      <div className="flex gap-3">
        {options.map((option) => (
          <OptionCard
            key={option}
            selected={selected === option}
            emoji={EMOJI[option]}
            label={t(LABEL_KEY[option])}
            accent="orange"
            onClick={() => onSelect(option)}
          />
        ))}
      </div>
      {!selected && (
        <Text type="secondary" className="text-xs mt-1 block">{tm("selectToContinue")}</Text>
      )}
      {tableField}
    </div>
  );
}
