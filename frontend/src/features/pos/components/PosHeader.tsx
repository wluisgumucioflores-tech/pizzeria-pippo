"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button, Tag, Typography } from "antd";
import { LogoutOutlined, ShoppingCartOutlined, UnorderedListOutlined, BarChartOutlined, GiftOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { formatTimeBolivia } from "@/lib/timezone";
import { useIsMobile } from "@/lib/useIsMobile";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";
import { getPrinterConfig } from "@/features/printing/services/printer-config.service";
import { DEFAULT_TICKET_BUSINESS_NAME } from "@/features/printing/constants/printing.constants";
import type { Branch, Identity, PosTab } from "../types/pos.types";

const { Text } = Typography;

interface Props {
  identity: Identity;
  branches: Branch[];
  activeTab: PosTab;
  pendingCount: number;
  promoCount: number;
  connected: boolean;
  onTabChange: (tab: PosTab) => void;
  onLogout: () => void;
  printerSlot?: React.ReactNode;
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <Tag color="red" style={{ margin: 0, flexShrink: 0 }} className="animate-pulse">
      🔴 Sin conexión
    </Tag>
  );
}

export function PosHeader({ identity, branches, activeTab, pendingCount, promoCount, connected, onTabChange, onLogout, printerSlot }: Props) {
  const branchName = branches.find((b) => b.id === identity.branch_id)?.name;
  const [currentTime, setCurrentTime] = useState("");
  const [businessName, setBusinessName] = useState(DEFAULT_TICKET_BUSINESS_NAME);
  const isMobile = useIsMobile();
  const t = useTranslations("pos");

  useEffect(() => {
    const tick = () => setCurrentTime(formatTimeBolivia(new Date()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    getPrinterConfig().then((config) => {
      if (mounted) setBusinessName(config.businessName);
    });
    return () => { mounted = false; };
  }, []);

  const tabBtn = (tab: PosTab, label: string, icon: React.ReactNode, badge?: number) => (
    <button
      onClick={() => onTabChange(tab)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: isMobile ? "8px 10px" : "6px 16px",
        border: "none",
        borderBottom: activeTab === tab ? "2px solid #ea580c" : "2px solid transparent",
        background: "transparent",
        color: activeTab === tab ? "#ea580c" : "#6b7280",
        fontWeight: activeTab === tab ? 700 : 500,
        fontSize: isMobile ? 12 : 14,
        cursor: "pointer",
        transition: "color 0.15s",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {icon}
      {!isMobile && label}
      {isMobile && tab === "orders" && t("tabs.orders")}
      {isMobile && tab === "sale" && t("tabs.sale")}
      {isMobile && tab === "summary" && t("tabs.summary")}
      {badge != null && badge > 0 && (
        <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, borderRadius: 10, padding: "1px 5px", marginLeft: 2 }}>
          {badge}
        </span>
      )}
    </button>
  );

  if (isMobile) {
    return (
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        {/* Mobile top row: logo + time + logout */}
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Image src="/logo.png" alt={businessName} width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          <Text strong style={{ fontSize: 13, color: "#ea580c", flexShrink: 0 }}>{businessName} POS</Text>
          <Tag color="blue" style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>{identity.name.split(" ")[0]}</Tag>
          <div style={{ flex: 1 }} />
          <Text style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "#374151", flexShrink: 0 }}>{currentTime}</Text>
          <ConnectionBadge connected={connected} />
          {printerSlot}
          <LocaleSwitcher />
          <Button
            size="small"
            icon={<LogoutOutlined />}
            onClick={onLogout}
            style={{ flexShrink: 0, padding: "0 8px" }}
          />
        </div>
        {/* Mobile tabs row */}
        <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
          {tabBtn("sale", t("tabs.sale"), <ShoppingCartOutlined />)}
          {tabBtn("promos", t("tabs.promosShort"), <GiftOutlined />, promoCount)}
          {tabBtn("orders", t("tabs.orders"), <UnorderedListOutlined />, pendingCount)}
          {tabBtn("summary", t("tabs.summary"), <BarChartOutlined />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      {/* Top row */}
      <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo.png" alt={businessName} width={34} height={34} style={{ borderRadius: "50%", objectFit: "cover" }} />
            <Text strong style={{ fontSize: 16, color: "#ea580c" }}>{businessName} — POS</Text>
          </div>
          <Tag color="blue" style={{ margin: 0 }}>{identity.name}</Tag>
          {identity.branch_id && <Tag color="green" style={{ margin: 0 }}>{branchName ?? t("header.branchFallback")}</Tag>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Text style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600, color: "#374151" }}>{currentTime}</Text>
          <ConnectionBadge connected={connected} />
          {printerSlot}
          <LocaleSwitcher />
          <Button icon={<LogoutOutlined />} onClick={onLogout}>{t("header.logout")}</Button>
        </div>
      </div>

      {/* Tabs row */}
      <div style={{ display: "flex", paddingLeft: 12, gap: 4, marginTop: -2 }}>
        {tabBtn("sale", t("tabs.sale"), <ShoppingCartOutlined />)}
        {tabBtn("promos", t("tabs.promos"), <GiftOutlined />, promoCount)}
        {tabBtn("orders", t("tabs.ordersFull"), <UnorderedListOutlined />, pendingCount)}
        {tabBtn("summary", t("tabs.summary"), <BarChartOutlined />)}
      </div>
    </div>
  );
}
