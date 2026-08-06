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
import { authProvider } from "@/lib/authProvider";
import { refineUnusedDataProvider } from "@/lib/refineUnusedDataProvider";
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

function AppFooter() {
  return (
    <div style={{ textAlign: "center", padding: "8px 16px", color: "#9ca3af", fontSize: 12, borderTop: "1px solid #f0f0f0" }}>
      Pippo Pizza — v{APP_VERSION}
    </div>
  );
}

function SiderTitle({ collapsed }: { collapsed: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Image
        src="/pippo.jpg"
        alt="Pippo Pizza"
        width={36}
        height={36}
        style={{ borderRadius: "50%", flexShrink: 0 }}
      />
      {!collapsed && (
        <span style={{ fontWeight: 700, fontSize: 14, color: "#f97316", lineHeight: 1.2, whiteSpace: "nowrap" }}>
          Pippo Pizza
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
  return (
    <AntdRegistry>
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
              meta: { label: "Dashboard", icon: <DashboardOutlined /> },
            },
            {
              name: "branches",
              list: "/branches",
              create: "/branches/create",
              edit: "/branches/edit/:id",
              meta: { label: "Sucursales", icon: <BankOutlined /> },
            },
            {
              name: "products",
              list: "/products",
              create: "/products/create",
              edit: "/products/edit/:id",
              meta: { label: "Productos", icon: <ShopOutlined /> },
            },
            {
              name: "variant-types",
              list: "/variant-types",
              meta: { label: "Tipos de variante", icon: <TagsOutlined /> },
            },
            {
              name: "ingredients",
              list: "/ingredients",
              create: "/ingredients/create",
              edit: "/ingredients/edit/:id",
              meta: { label: "Insumos", icon: <InboxOutlined /> },
            },
            {
              name: "stock",
              list: "/stock",
              meta: { label: "Stock", icon: <DatabaseOutlined /> },
            },
            {
              name: "warehouse",
              list: "/warehouse",
              meta: { label: "Bodega", icon: <HomeOutlined /> },
            },
            {
              name: "promotions",
              list: "/promotions",
              create: "/promotions/create",
              edit: "/promotions/edit/:id",
              meta: { label: "Promociones", icon: <GiftOutlined /> },
            },
            {
              name: "users",
              list: "/users",
              create: "/users/create",
              edit: "/users/edit/:id",
              meta: { label: "Usuarios", icon: <TeamOutlined /> },
            },
            {
              name: "employees",
              list: "/employees",
              meta: { label: "Empleados", icon: <IdcardOutlined /> },
            },
            {
              name: "attendance",
              list: "/attendance",
              meta: { label: "Asistencia", icon: <ScheduleOutlined /> },
            },
            {
              name: "reports",
              list: "/reports",
              meta: { label: "Reportes", icon: <BarChartOutlined /> },
            },
            {
              name: "settings",
              list: "/settings",
              meta: { label: "Configuración", icon: <SettingOutlined /> },
            },
          ]}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
          }}
        >
          <Authenticated key="admin-auth">
            <ThemedLayout Sider={() => <ThemedSider fixed Title={SiderTitle} />} Footer={AppFooter}>
              {children}
            </ThemedLayout>
          </Authenticated>
          <RefineKbar />
        </Refine>
      </RefineKbarProvider>
    </AntdRegistry>
  );
}
