"use client";

import { Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { WalletOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { CashSession } from "../types/cashbox.types";

interface Props {
  session: CashSession | null;
  loading: boolean;
  onOpen: () => void;
  onExpense: () => void;
  onClose: () => void;
}

// Un solo botón-icono, como printerSlot/el menú de usuario — el resto del
// header del POS ya está muy apretado en mobile, así que esto NUNCA debe
// ocupar más de un elemento (un Tag + 2 botones aparte desbordaba la fila
// y tapaba el resto de los íconos en pantallas chicas).
export function CashboxHeaderSlot({ session, loading, onOpen, onExpense, onClose }: Props) {
  const t = useTranslations("cashbox.header");
  if (loading) return null;

  if (!session) {
    return (
      <Tooltip title={t("openButton")}>
        <Button size="small" icon={<WalletOutlined />} onClick={onOpen} style={{ flexShrink: 0 }} />
      </Tooltip>
    );
  }

  const menu: MenuProps = {
    items: [
      { key: "expense", label: t("expenseButton") },
      { key: "close", label: t("closeButton"), danger: true },
    ],
    onClick: ({ key }) => (key === "expense" ? onExpense() : onClose()),
  };

  return (
    <Tooltip title={`${t("openTag")} · Bs ${session.opening_amount.toFixed(2)}`}>
      <Dropdown trigger={["click"]} menu={menu}>
        <Button
          size="small"
          icon={<WalletOutlined />}
          style={{ flexShrink: 0, color: "#16a34a", borderColor: "#16a34a" }}
        />
      </Dropdown>
    </Tooltip>
  );
}
