import { ROLE_MODULE_MAP, type EnabledModules } from "@pippo/shared";

type Translate = (key: string) => string;

const ALL_ROLES = ["cajero", "cocinero", "mesero", "admin", "produccion"] as const;

// Each role is only offered if the superadmin enabled it for this business
// (see ROLE_MODULE_MAP / businesses panel) — prevents creating users of a
// role the business hasn't contracted.
export function getRoleOptions(t: Translate, enabledModules?: EnabledModules | null) {
  return ALL_ROLES.filter((role) => !enabledModules || enabledModules[ROLE_MODULE_MAP[role]]).map((role) => ({
    value: role,
    label: t(`roles.${role}`),
  }));
}

export function getRoleLabels(t: Translate): Record<string, string> {
  return {
    admin: t("roles.admin"),
    cocinero: t("roles.cocinero"),
    cajero: t("roles.cajero"),
    mesero: t("roles.mesero"),
    produccion: t("roles.produccion"),
  };
}

export const ROLE_COLORS: Record<string, string> = {
  admin: "blue",
  cocinero: "orange",
  cajero: "green",
  mesero: "purple",
  produccion: "gold",
};
