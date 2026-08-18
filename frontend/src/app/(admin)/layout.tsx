"use client";

import { useEffect, useMemo, useState } from "react";
import { Refine, Authenticated, useGetIdentity } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { Layout as AntdLayout, Typography, Avatar, Space, theme, Skeleton } from "antd";
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
import { DEFAULT_ENABLED_MODULES, type EnabledModules } from "@pippo/shared";
import { authProvider } from "@/lib/authProvider";
import { getUserProfile } from "@/lib/auth";
import { refineUnusedDataProvider } from "@/lib/refineUnusedDataProvider";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";
import Image from "next/image";
import { buildAdminResources } from "./admin-resources";

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
  const [enabledModules, setEnabledModules] = useState<EnabledModules | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    getUserProfile().then((profile) => {
      setEnabledModules(profile?.enabled_modules ?? null);
      setProfileReady(true);
    });
  }, []);

  const resources = useMemo(
    () => buildAdminResources(t, enabledModules ?? DEFAULT_ENABLED_MODULES),
    [t, enabledModules],
  );

  if (!profileReady) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <AntdRegistry>
      <ConfigProvider locale={locale === "en" ? enUS : esES}>
      <RefineKbarProvider>
        <Refine
          dataProvider={refineUnusedDataProvider}
          routerProvider={routerProvider}
          authProvider={authProvider}
          notificationProvider={useNotificationProvider}
          resources={resources}
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
