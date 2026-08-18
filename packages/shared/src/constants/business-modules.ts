// Single source of truth for optional business modules — add a new flaggable
// module here and every place that reads/writes enabled_modules picks it up.
export const BUSINESS_MODULE_KEYS = ["kitchen", "stock", "employees", "telegram", "printer", "mesero"] as const;

export type BusinessModuleKey = (typeof BUSINESS_MODULE_KEYS)[number];

export type EnabledModules = Record<BusinessModuleKey, boolean>;

export const DEFAULT_ENABLED_MODULES: EnabledModules = {
  kitchen: true,
  stock: true,
  employees: true,
  telegram: false,
  printer: true,
  mesero: false,
};
