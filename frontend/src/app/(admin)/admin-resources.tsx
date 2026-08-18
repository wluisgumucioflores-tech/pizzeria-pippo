import type { EnabledModules } from "@pippo/shared";
import type { ReactNode } from "react";
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
  AppstoreOutlined,
  SettingOutlined,
  IdcardOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";

interface ResourceDef {
  name: string;
  list: string;
  create?: string;
  edit?: string;
  meta: { label: string; icon: ReactNode };
}

// Arma el array de resources de Refine filtrando los módulos opcionales que el
// negocio tiene apagados (enabled_modules) — así no aparecen en el sidebar.
export function buildAdminResources(t: (key: string) => string, enabledModules: EnabledModules): ResourceDef[] {
  const resources: ResourceDef[] = [
    { name: "dashboard", list: "/dashboard", meta: { label: t("dashboard"), icon: <DashboardOutlined /> } },
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
    { name: "variant-types", list: "/variant-types", meta: { label: t("variantTypes"), icon: <TagsOutlined /> } },
    {
      name: "ingredients",
      list: "/ingredients",
      create: "/ingredients/create",
      edit: "/ingredients/edit/:id",
      meta: { label: t("ingredients"), icon: <InboxOutlined /> },
    },
    { name: "categories", list: "/categories", meta: { label: t("categories"), icon: <AppstoreOutlined /> } },
    ...(enabledModules.stock
      ? [
          { name: "stock", list: "/stock", meta: { label: t("stock"), icon: <DatabaseOutlined /> } },
          { name: "warehouse", list: "/warehouse", meta: { label: t("warehouse"), icon: <HomeOutlined /> } },
        ]
      : []),
    {
      name: "promotions",
      list: "/promotions",
      create: "/promotions/create",
      edit: "/promotions/edit/:id",
      meta: { label: t("promotions"), icon: <GiftOutlined /> },
    },
    { name: "users", list: "/users", create: "/users/create", edit: "/users/edit/:id", meta: { label: t("users"), icon: <TeamOutlined /> } },
    ...(enabledModules.employees
      ? [
          { name: "employees", list: "/employees", meta: { label: t("employees"), icon: <IdcardOutlined /> } },
          { name: "attendance", list: "/attendance", meta: { label: t("attendance"), icon: <ScheduleOutlined /> } },
        ]
      : []),
    { name: "reports", list: "/reports", meta: { label: t("reports"), icon: <BarChartOutlined /> } },
    { name: "settings", list: "/settings", meta: { label: t("settings"), icon: <SettingOutlined /> } },
  ];

  return resources;
}
