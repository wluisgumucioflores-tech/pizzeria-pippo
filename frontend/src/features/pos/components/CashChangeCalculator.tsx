"use client";

import { InputNumber, Typography, Button } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface Props {
  amountDue: number;
  received: number | null;
  change: number | null;
  insufficient: boolean;
  suggestions: number[];
  onReceivedChange: (value: number | null) => void;
}

/**
 * "Paga con" + the change owed back. Deliberately optional: leaving it empty
 * confirms the sale exactly as before, so it never slows the cashier down.
 *
 * Labelled "Paga con" and not "Efectivo recibido" on purpose — that label is
 * already taken by the split-payment panel, where it means the portion paid in
 * cash (capped at the total). Here the amount is expected to EXCEED what's due.
 */
export function CashChangeCalculator({
  amountDue,
  received,
  change,
  insufficient,
  suggestions,
  onReceivedChange,
}: Props) {
  const t = useTranslations("pos.cashChange");

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 4, height: 16, background: "#16a34a", borderRadius: 2 }} />
          <Text strong>{t("paysWith")}</Text>
        </div>
        <Text type="secondary" className="text-xs">{t("optional")}</Text>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="large"
          onClick={() => onReceivedChange(amountDue)}
          type={received === amountDue ? "primary" : "default"}
        >
          {t("exact")}
        </Button>
        {suggestions.map((amount) => (
          <Button
            key={amount}
            size="large"
            onClick={() => onReceivedChange(amount)}
            type={received === amount ? "primary" : "default"}
          >
            {amount}
          </Button>
        ))}
        <InputNumber
          value={received}
          min={0}
          placeholder={t("otherAmount")}
          style={{ width: 120, height: 40 }}
          onChange={(value) => onReceivedChange(value ?? null)}
        />
        {received !== null && (
          <Button size="large" type="text" onClick={() => onReceivedChange(null)}>
            {t("clear")}
          </Button>
        )}
      </div>

      {change !== null && !insufficient && (
        <div className="flex justify-between items-center mt-3 rounded-lg px-4 py-3 bg-green-50">
          <Text strong className="!text-green-700">{t("changeDue")}</Text>
          <Text strong className="!text-green-700" style={{ fontSize: 28, lineHeight: 1.2 }}>
            Bs {change.toFixed(2)}
          </Text>
        </div>
      )}

      {insufficient && change !== null && (
        <div className="flex justify-between items-center mt-3 rounded-lg px-4 py-3 bg-red-50">
          <Text strong className="!text-red-600">{t("missing")}</Text>
          <Text strong className="!text-red-600" style={{ fontSize: 20, lineHeight: 1.2 }}>
            Bs {Math.abs(change).toFixed(2)}
          </Text>
        </div>
      )}
    </div>
  );
}
