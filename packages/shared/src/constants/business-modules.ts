// Single source of truth for optional business modules — add a new flaggable
// module here and every place that reads/writes enabled_modules picks it up.
export const BUSINESS_MODULE_KEYS = ["kitchen", "stock", "employees", "telegram", "printer", "mesero", "mcpSaas", "aiChat", "produccion", "admin", "cajero"] as const;

export type BusinessModuleKey = (typeof BUSINESS_MODULE_KEYS)[number];

export type EnabledModules = Record<BusinessModuleKey, boolean>;

export const DEFAULT_ENABLED_MODULES: EnabledModules = {
  kitchen: true,
  stock: true,
  employees: true,
  telegram: false,
  printer: true,
  mesero: false,
  mcpSaas: false,
  aiChat: false,
  produccion: false,
  // admin/cajero are base roles every business could already create before
  // this per-role control existed — default true so we don't break
  // existing businesses that never configured this explicitly.
  admin: true,
  cajero: true,
};

// Maps each user role to the enabledModules key that decides whether the
// superadmin enabled it for that business. cocinero/mesero reuse the
// existing "kitchen"/"mesero" modules (if the business doesn't have the
// kitchen panel, it doesn't make sense for it to create cocinero users).
export const ROLE_MODULE_MAP: Record<string, BusinessModuleKey> = {
  admin: "admin",
  cajero: "cajero",
  cocinero: "kitchen",
  mesero: "mesero",
  produccion: "produccion",
};
