"use client";

import { useRouter } from "next/navigation";
import { Tag, Space, Button } from "antd";
import { useTranslations } from "next-intl";
import { IconWarning, IconHistory, IconCart, IconSwap } from "./WarehouseIcons";

interface Props {
  isMobile: boolean;
  alertCount: number;
  // Root of the warehouse route tree — "/warehouse" under (admin), or
  // "/produccion/bodega" under the produccion panel. Each panel mounts its
  // own movements/purchase/transfer sub-pages at this same root.
  basePath?: string;
  // produccion doesn't get the movements/history sub-page — admin keeps it.
  hideHistory?: boolean;
}

export function WarehousePageHeader({ isMobile, alertCount, basePath = "/warehouse", hideHistory }: Props) {
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
        {!hideHistory && (
          <Button icon={<IconHistory />} onClick={() => router.push(`${basePath}/movements`)} block={isMobile}>{t("history")}</Button>
        )}
        <Button icon={<IconCart />} onClick={() => router.push(`${basePath}/purchase`)} block={isMobile}>{isMobile ? t("newPurchaseShort") : t("newPurchase")}</Button>
        <Button type="primary" icon={<IconSwap />} onClick={() => router.push(`${basePath}/transfer`)} block={isMobile}>{t("transfer")}</Button>
      </Space>
    </div>
  );
}
