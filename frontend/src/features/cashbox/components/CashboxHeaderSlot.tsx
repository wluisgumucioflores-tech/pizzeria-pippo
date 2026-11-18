"use client";

import { Button, Tag } from "antd";
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

export function CashboxHeaderSlot({ session, loading, onOpen, onExpense, onClose }: Props) {
  const t = useTranslations("cashbox.header");
  if (loading) return null;

  if (!session) {
    return (
      <Button size="small" icon={<WalletOutlined />} onClick={onOpen} style={{ flexShrink: 0 }}>
        {t("openButton")}
      </Button>
    );
  }

  return (
    <>
      <Tag color="green" style={{ margin: 0, flexShrink: 0 }}>
        {t("openTag")} · Bs {session.opening_amount.toFixed(2)}
      </Tag>
      <Button size="small" onClick={onExpense} style={{ flexShrink: 0 }}>
        {t("expenseButton")}
      </Button>
      <Button size="small" danger onClick={onClose} style={{ flexShrink: 0 }}>
        {t("closeButton")}
      </Button>
    </>
  );
}
