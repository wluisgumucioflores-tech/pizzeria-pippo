export const TYPE_COLORS: Record<string, string> = {
  compra: "green",
  venta: "blue",
  ajuste: "orange",
  anulacion: "red",
};

export function getTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    compra: t("compra"),
    venta: t("venta"),
    ajuste: t("ajuste"),
    anulacion: t("anulacion"),
  };
}
