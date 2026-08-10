"use client";

import { useRouter } from "next/navigation";
import { Tag, Space, Button } from "antd";
import { useTranslations } from "next-intl";
import { IconWarning, IconHistory, IconCart, IconSwap } from "./WarehouseIcons";

interface Props {
  isMobile: boolean;
  alertCount: number;
}

export function WarehousePageHeader({ isMobile, alertCount }: Props) {
  const router = useRouter();
  const t = useTranslations("warehouse");

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 16 }}>
      <Space>
        <h2 className="text-lg font-semibold m-0">{t("title")}</h2>
        {alertCount > 0 && (
          <Tag color="red" icon={<IconWarning />}>
            {t("lowStockAlert", { count: alertCount })}
          </Tag>
        )}
      </Space>
      <Space wrap>
        <Button icon={<IconHistory />} onClick={() => router.push("/warehouse/movements")} block={isMobile}>{t("history")}</Button>
        <Button icon={<IconCart />} onClick={() => router.push("/warehouse/purchase")} block={isMobile}>{isMobile ? t("newPurchaseShort") : t("newPurchase")}</Button>
        <Button type="primary" icon={<IconSwap />} onClick={() => router.push("/warehouse/transfer")} block={isMobile}>{t("transfer")}</Button>
      </Space>
    </div>
  );
}
