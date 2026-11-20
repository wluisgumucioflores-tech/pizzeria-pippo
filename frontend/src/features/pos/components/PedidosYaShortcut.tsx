"use client";

import { Checkbox, Typography } from "antd";
import { PAYMENT_PROVIDERS } from "@pippo/shared";
import { useTranslations } from "next-intl";

const { Text } = Typography;

// Único proveedor online que existe hoy — ver PaymentModal para por qué
// tildarlo es la única forma de crear un pedido pedidos_ya desde el POS.
export const ONLINE_PROVIDER = "pedidos_ya" as const;

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function PedidosYaShortcut({ checked, onChange }: Props) {
  const tm = useTranslations("pos.paymentModal");

  return (
    <div className="flex items-start gap-2.5 bg-blue-50 rounded-lg px-3 py-2">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <div>
        <Text strong className="block text-sm">
          {tm("onlineOrder", { provider: PAYMENT_PROVIDERS[ONLINE_PROVIDER].label })}
        </Text>
        <Text type="secondary" className="text-xs block">
          {tm("onlineHint")}
        </Text>
      </div>
    </div>
  );
}
