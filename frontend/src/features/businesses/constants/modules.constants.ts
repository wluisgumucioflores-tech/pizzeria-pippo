import { BUSINESS_MODULE_KEYS, DEFAULT_ENABLED_MODULES, type BusinessModuleKey } from "@pippo/shared";

export { BUSINESS_MODULE_KEYS, DEFAULT_ENABLED_MODULES };
export type { BusinessModuleKey };

export const MODULE_LABELS: Record<BusinessModuleKey, string> = {
  kitchen: "Cocina",
  stock: "Stock / Inventario / Almacén",
  employees: "Empleados / Asistencia",
  telegram: "Bot de Telegram / Notificaciones",
  printer: "Impresora / Dispositivos",
  mesero: "Mesero (mesas / dine-in)",
};

export const DEFAULT_ENABLED_MODULES_LIST: BusinessModuleKey[] = BUSINESS_MODULE_KEYS.filter(
  (key) => DEFAULT_ENABLED_MODULES[key],
);
