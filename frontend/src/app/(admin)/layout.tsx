"use client";

import { Refine, Authenticated, useGetIdentity } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { Layout as AntdLayout, Typography, Avatar, Space, theme } from "antd";
import {
  ThemedLayout,
  ThemedSider,
  useNotificationProvider,
} from "@refinedev/antd";
import routerProvider from "@refinedev/nextjs-router";
import "@refinedev/antd/dist/reset.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import enUS from "antd/locale/en_US";
import { useLocale, useTranslations } from "next-intl";
import { authProvider } from "@/lib/authProvider";
import { refineUnusedDataProvider } from "@/lib/refineUnusedDataProvider";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";
import Image from "next/image";
import {
  DashboardOutlined,
  BankOutlined,
  ShopOutlined,
  InboxOutlined,
  DatabaseOutlined,
  GiftOutlined,
  TeamOutlined,
  BarChartOutlined,
  HomeOutlined,
  TagsOutlined,
  SettingOutlined,
  IdcardOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

interface Identity {
  business_name: string | null;
}

function AppFooter() {
  const { data: identity } = useGetIdentity<Identity>();
  const businessName = identity?.business_name ?? "Pippo Pizza";

  return (
    <div style={{ textAlign: "center", padding: "8px 16px", color: "#9ca3af", fontSize: 12, borderTop: "1px solid #f0f0f0" }}>
      {businessName} — v{APP_VERSION}
    </div>
  );
}

function AdminHeader() {
  const { data: user } = useGetIdentity<Identity & { name?: string; avatar?: string | null }>();
  const { token } = theme.useToken();

  return (
    <AntdLayout.Header
      style={{
        backgroundColor: token.colorBgElevated,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "0 24px",
        height: 64,
      }}
    >
      <Space size="middle">
        <LocaleSwitcher />
        {(user?.name || user?.avatar) && (
          <Space size="middle">
            {user?.name && <Typography.Text strong>{user.name}</Typography.Text>}
            {user?.avatar && <Avatar src={user.avatar} alt={user.name} />}
          </Space>
        )}
      </Space>
    </AntdLayout.Header>
  );
}

function SiderTitle({ collapsed }: { collapsed: boolean }) {
  const { data: identity } = useGetIdentity<Identity>();
  const businessName = identity?.business_name ?? "Pippo Pizza";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Image
        src="/logo.png"
        alt={businessName}
        width={36}
        height={36}
        style={{ borderRadius: "50%", flexShrink: 0 }}
      />
      {!collapsed && (
        <span style={{ fontWeight: 700, fontSize: 14, color: "#f97316", lineHeight: 1.2, whiteSpace: "nowrap" }}>
          {businessName}
        </span>
      )}
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations("nav");

  return (
    <AntdRegistry>
      <ConfigProvider locale={locale === "en" ? enUS : esES}>
      <RefineKbarProvider>
        <Refine
          dataProvider={refineUnusedDataProvider}
          routerProvider={routerProvider}
          authProvider={authProvider}
          notificationProvider={useNotificationProvider}
          resources={[
            {
              name: "dashboard",
              list: "/dashboard",
              meta: { label: t("dashboard"), icon: <DashboardOutlined /> },
            },
            {
              name: "branches",
              list: "/branches",
              create: "/branches/create",
              edit: "/branches/edit/:id",
              meta: { label: t("branches"), icon: <BankOutlined /> },
            },
            {
              name: "products",
              list: "/products",
              create: "/products/create",
              edit: "/products/edit/:id",
              meta: { label: t("products"), icon: <ShopOutlined /> },
            },
            {
              name: "variant-types",
              list: "/variant-types",
              meta: { label: t("variantTypes"), icon: <TagsOutlined /> },
            },
            {
              name: "ingredients",
              list: "/ingredients",
              create: "/ingredients/create",
              edit: "/ingredients/edit/:id",
              meta: { label: t("ingredients"), icon: <InboxOutlined /> },
            },
            {
              name: "stock",
              list: "/stock",
              meta: { label: t("stock"), icon: <DatabaseOutlined /> },
            },
            {
              name: "warehouse",
              list: "/warehouse",
              meta: { label: t("warehouse"), icon: <HomeOutlined /> },
            },
            {
              name: "promotions",
              list: "/promotions",
              create: "/promotions/create",
              edit: "/promotions/edit/:id",
              meta: { label: t("promotions"), icon: <GiftOutlined /> },
            },
            {
              name: "users",
              list: "/users",
              create: "/users/create",
              edit: "/users/edit/:id",
              meta: { label: t("users"), icon: <TeamOutlined /> },
            },
            {
              name: "employees",
              list: "/employees",
              meta: { label: t("employees"), icon: <IdcardOutlined /> },
            },
            {
              name: "attendance",
              list: "/attendance",
              meta: { label: t("attendance"), icon: <ScheduleOutlined /> },
            },
            {
              name: "reports",
              list: "/reports",
              meta: { label: t("reports"), icon: <BarChartOutlined /> },
            },
            {
              name: "settings",
              list: "/settings",
              meta: { label: t("settings"), icon: <SettingOutlined /> },
            },
          ]}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
          }}
        >
          <Authenticated key="admin-auth">
            <ThemedLayout Sider={() => <ThemedSider fixed Title={SiderTitle} />} Header={AdminHeader} Footer={AppFooter}>
              {children}
            </ThemedLayout>
          </Authenticated>
          <RefineKbar />
        </Refine>
      </RefineKbarProvider>
      </ConfigProvider>
    </AntdRegistry>
  );
}
