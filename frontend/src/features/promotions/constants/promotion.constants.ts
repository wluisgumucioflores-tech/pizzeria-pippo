type Translate = (key: string) => string;

export function getTypeOptions(t: Translate) {
  return [
    { value: "BUY_X_GET_Y", label: t("types.buyXGetY") },
    { value: "PERCENTAGE", label: t("types.percentage") },
    { value: "COMBO", label: t("types.combo") },
  ];
}

export const TYPE_COLORS: Record<string, string> = {
  BUY_X_GET_Y: "red",
  PERCENTAGE: "blue",
  COMBO: "green",
};

export function getDays(t: Translate) {
  return [
    { value: 0, label: t("daysShort.0") },
    { value: 1, label: t("daysShort.1") },
    { value: 2, label: t("daysShort.2") },
    { value: 3, label: t("daysShort.3") },
    { value: 4, label: t("daysShort.4") },
    { value: 5, label: t("daysShort.5") },
    { value: 6, label: t("daysShort.6") },
  ];
}
