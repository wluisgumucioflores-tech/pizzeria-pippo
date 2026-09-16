import { BUSINESS_MODULE_KEYS, DEFAULT_ENABLED_MODULES, type BusinessModuleKey } from "@pippo/shared";

export { BUSINESS_MODULE_KEYS, DEFAULT_ENABLED_MODULES };
export type { BusinessModuleKey };

export const MODULE_LABELS: Record<BusinessModuleKey, string> = {
  kitchen: "Rol: Cocinero (+ panel de Cocina)",
  stock: "Stock / Inventario / Almacén",
  employees: "Empleados / Asistencia",
  telegram: "Bot de Telegram / Notificaciones",
  printer: "Impresora / Dispositivos",
  mesero: "Rol: Mesero (mesas / dine-in)",
  mcpSaas: "MCP (servidor MCP externo)",
  aiChat: "Chat IA (asistente inteligente)",
  produccion: "Rol: Jefe de Producción (registro de insumos y elaboración)",
  admin: "Rol: Administrador (puede crear otros admins)",
  cajero: "Rol: Cajero",
};

// Subset of modules that actually control whether a user ROLE can be
// created in Users (see ROLE_MODULE_MAP in @pippo/shared) — shown grouped
// separately in the business form so they don't mix with standalone
// features like Telegram or Printer.
export const ROLE_MODULE_KEYS: BusinessModuleKey[] = ["admin", "cajero", "kitchen", "mesero", "produccion"];
export const FEATURE_MODULE_KEYS: BusinessModuleKey[] = BUSINESS_MODULE_KEYS.filter(
  (key) => !ROLE_MODULE_KEYS.includes(key),
);

export const DEFAULT_ENABLED_MODULES_LIST: BusinessModuleKey[] = BUSINESS_MODULE_KEYS.filter(
  (key) => DEFAULT_ENABLED_MODULES[key],
);
