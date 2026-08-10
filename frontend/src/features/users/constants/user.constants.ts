type Translate = (key: string) => string;

export function getRoleOptions(t: Translate) {
  return [
    { value: "cajero", label: t("roles.cajero") },
    { value: "cocinero", label: t("roles.cocinero") },
    { value: "admin", label: t("roles.admin") },
  ];
}

export function getRoleLabels(t: Translate): Record<string, string> {
  return {
    admin: t("roles.admin"),
    cocinero: t("roles.cocinero"),
    cajero: t("roles.cajero"),
  };
}

export const ROLE_COLORS: Record<string, string> = {
  admin: "blue",
  cocinero: "orange",
  cajero: "green",
};
