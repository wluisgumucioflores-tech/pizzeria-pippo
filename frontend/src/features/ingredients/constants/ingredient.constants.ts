export function getUnitOptions(t: (key: string) => string) {
  return [
    { value: "g", label: t("units.g") },
    { value: "kg", label: t("units.kg") },
    { value: "ml", label: t("units.ml") },
    { value: "l", label: t("units.l") },
    { value: "unidad", label: t("units.unidad") },
  ];
}

export const UNIT_COLORS: Record<string, string> = {
  g: "blue", kg: "geekblue", ml: "cyan", l: "teal", unidad: "purple",
};
