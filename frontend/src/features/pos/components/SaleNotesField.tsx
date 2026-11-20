"use client";

import { Input, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SaleNotesField({ value, onChange }: Props) {
  const t = useTranslations("pos");
  const tm = useTranslations("pos.paymentModal");

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 4, height: 16, background: "#9ca3af", borderRadius: 2 }} />
          <Text strong>{tm("note")}</Text>
        </div>
        <Text type="secondary" className="text-xs">{t("optional")}</Text>
      </div>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tm("notePlaceholder")}
        maxLength={300}
        rows={2}
        showCount
      />
    </div>
  );
}
