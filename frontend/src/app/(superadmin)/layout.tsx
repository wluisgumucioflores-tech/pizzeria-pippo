"use client";

import { Refine, Authenticated } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import {
  ThemedLayout,
  ThemedSider,
  useNotificationProvider,
} from "@refinedev/antd";
import routerProvider from "@refinedev/nextjs-router";
import "@refinedev/antd/dist/reset.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Layout as AntdLayout, Button, theme } from "antd";
import { useTranslations } from "next-intl";
import { authProviderSuperadmin } from "@/lib/authProviderSuperadmin";
import { refineUnusedDataProvider } from "@/lib/refineUnusedDataProvider";
import { ChangePasswordModal } from "@/features/account/components/ChangePasswordModal";
import { useChangePassword } from "@/features/account/hooks/useChangePassword";
import Image from "next/image";
import { ShopOutlined, KeyOutlined, CommentOutlined, RobotOutlined } from "@ant-design/icons";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

function SuperadminHeader() {
  const { token } = theme.useToken();
  const t = useTranslations("account");
  const { open, saving, form, openModal, closeModal, handleSubmit } = useChangePassword();

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
      <Button type="text" icon={<KeyOutlined />} onClick={openModal}>
        {t("changePassword")}
      </Button>
      <ChangePasswordModal open={open} saving={saving} form={form} onClose={closeModal} onSubmit={handleSubmit} />
    </AntdLayout.Header>
  );
}

function AppFooter() {
  return (
    <div style={{ textAlign: "center", padding: "8px 16px", color: "#9ca3af", fontSize: 12, borderTop: "1px solid #f0f0f0" }}>
      Pippo SaaS — v{APP_VERSION}
    </div>
  );
}

function SiderTitle({ collapsed }: { collapsed: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Image
        src="/logo.png"
        alt="Pippo SaaS"
        width={36}
        height={36}
        style={{ borderRadius: "50%", flexShrink: 0 }}
      />
      {!collapsed && (
        <span style={{ fontWeight: 700, fontSize: 14, color: "#f97316", lineHeight: 1.2, whiteSpace: "nowrap" }}>
          Pippo SaaS — Superadmin
        </span>
      )}
    </div>
  );
}

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdRegistry>
      <RefineKbarProvider>
        <Refine
          dataProvider={refineUnusedDataProvider}
          routerProvider={routerProvider}
          authProvider={authProviderSuperadmin}
          notificationProvider={useNotificationProvider}
          resources={[
            {
              name: "businesses",
              list: "/businesses",
              meta: { label: "Negocios", icon: <ShopOutlined /> },
            },
            {
              name: "ai-chat-plans",
              list: "/ai-chat-plans",
              meta: { label: "Planes Chat IA", icon: <CommentOutlined /> },
            },
            {
              name: "ai-models",
              list: "/ai-models",
              meta: { label: "Modelos de IA", icon: <RobotOutlined /> },
            },
          ]}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
          }}
        >
          <Authenticated key="superadmin-auth">
            <ThemedLayout Sider={() => <ThemedSider fixed Title={SiderTitle} />} Header={SuperadminHeader} Footer={AppFooter}>
              {children}
            </ThemedLayout>
          </Authenticated>
          <RefineKbar />
        </Refine>
      </RefineKbarProvider>
    </AntdRegistry>
  );
}
