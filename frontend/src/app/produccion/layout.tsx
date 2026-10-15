"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Button, ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import enUS from "antd/locale/en_US";
import { LogoutOutlined } from "@ant-design/icons";
import { useLocale, useTranslations } from "next-intl";
import { getUserProfile, signOut } from "@/lib/auth";
import { useIsMobile } from "@/lib/useIsMobile";

const { Header, Sider, Content } = Layout;

export default function ProduccionLayout({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [stockMode, setStockMode] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("production");
  const locale = useLocale();
  const isMobile = useIsMobile();

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (!profile) {
        window.location.href = "/login";
        return;
      }
      if (profile.role !== "produccion" && profile.role !== "admin") {
        window.location.href = "/login";
        return;
      }
      // Immediate cutoff if the superadmin turns off the module after the
      // user was created — same criteria as the backend's 403 in ProductionService.
      if (!profile.enabled_modules.produccion) {
        window.location.href = "/login";
        return;
      }
      setBusinessName(profile.business_name);
      // produccionStock swaps this panel's menu to Stock/Bodega instead of
      // the usual insumos/elaboracion/transferencia — see CLAUDE.md feature
      // flags rule. Defaults to false, so existing businesses using jefe de
      // producción today are unaffected until a superadmin opts them in.
      setStockMode(!!profile.enabled_modules.produccionStock);
      setAllowed(true);
    });
  }, []);

  if (!allowed) return null;

  const selectedKey = pathname.startsWith("/produccion/elaboracion")
    ? "elaboracion"
    : pathname.startsWith("/produccion/transferencia")
      ? "transferencia"
      : pathname.startsWith("/produccion/bodega")
        ? "bodega"
        : pathname.startsWith("/produccion/stock")
          ? "stock"
          : "insumos";
  // produccionStock adds Stock/Bodega and hides insumos/elaboracion (the
  // logging pages) — transferencia (Fase 10 self-service transfer) stays
  // either way, it's a separate, already-working feature.
  const menuItems = stockMode
    ? [
        { key: "stock", label: t("menu.stock") },
        { key: "bodega", label: t("menu.bodega") },
        { key: "transferencia", label: t("menu.transferencia") },
      ]
    : [
        { key: "insumos", label: t("menu.insumos") },
        { key: "elaboracion", label: t("menu.elaboracion") },
        { key: "transferencia", label: t("menu.transferencia") },
      ];

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  // The fixed 220px Sider eats up almost half of a phone screen — on
  // mobile it's replaced by a top bar + horizontal menu, no permanent
  // sidebar.
  if (isMobile) {
    return (
      <ConfigProvider locale={locale === "en" ? enUS : esES}>
        <Layout style={{ minHeight: "100vh" }}>
          <Header
            style={{
              background: "#fff", height: "auto", lineHeight: "normal", padding: "10px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0",
            }}
          >
            <span className="font-semibold text-orange-500 truncate">{businessName ?? "Pippo Pizza"}</span>
            <Button size="small" icon={<LogoutOutlined />} onClick={handleLogout}>
              {t("menu.logout")}
            </Button>
          </Header>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            onClick={({ key }) => router.push(`/produccion/${key}`)}
            items={menuItems}
          />
          <Content>{children}</Content>
        </Layout>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={locale === "en" ? enUS : esES}>
      <Layout style={{ minHeight: "100vh" }}>
        <Sider theme="light" width={220} className="flex flex-col justify-between">
          <div>
            <div className="h-16 flex items-center px-4 font-semibold text-orange-500 border-b border-gray-100">
              {businessName ?? "Pippo Pizza"}
            </div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              onClick={({ key }) => router.push(`/produccion/${key}`)}
              items={menuItems}
            />
          </div>
          <div className="p-4 border-t border-gray-100">
            <Button block icon={<LogoutOutlined />} onClick={handleLogout}>
              {t("menu.logout")}
            </Button>
          </div>
        </Sider>
        <Content>{children}</Content>
      </Layout>
    </ConfigProvider>
  );
}
