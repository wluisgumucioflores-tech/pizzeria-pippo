"use client";

import { useState } from "react";
import type { FocusEvent } from "react";
import { Button, InputNumber, Space, Typography } from "antd";
import { EditOutlined, PlusOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { Text } = Typography;

// Selecciona todo el texto al enfocar: sin esto, escribir sobre un campo en 0
// inserta el dígito antes del 0 (ej. tipear "5" deja "05") en vez de reemplazarlo.
function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}

interface Props {
  variantId: string;
  branchId: string;
  price: number | undefined;
  saving: boolean;
  onSave: (variantId: string, branchId: string, price: number) => Promise<void>;
}

export function PriceCell({ variantId, branchId, price, saving, onSave }: Props) {
  const t = useTranslations("products.branchPricesTable");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number>(price ?? 0);

  const handleSave = async () => {
    await onSave(variantId, branchId, value);
    setEditing(false);
  };

  const handleCancel = () => {
    setValue(price ?? 0);
    setEditing(false);
  };

  if (editing) {
    return (
      <Space>
        <InputNumber
          prefix="Bs"
          value={value}
          onChange={(v) => setValue(v ?? 0)}
          onFocus={selectOnFocus}
          min={0}
          style={{ width: 110 }}
          autoFocus
          onPressEnter={handleSave}
        />
        <Button size="small" type="primary" icon={<CheckOutlined />} loading={saving} onClick={handleSave} />
        <Button size="small" icon={<CloseOutlined />} onClick={handleCancel} />
      </Space>
    );
  }

  if (price !== undefined) {
    return (
      <Space>
        <Text strong>Bs {Number(price).toFixed(2)}</Text>
        <Button size="small" icon={<EditOutlined />} onClick={() => { setValue(price); setEditing(true); }} />
      </Space>
    );
  }

  return (
    <Button size="small" icon={<PlusOutlined />} onClick={() => { setValue(0); setEditing(true); }}>
      {t("assign")}
    </Button>
  );
}
