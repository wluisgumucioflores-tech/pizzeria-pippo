// Flujo de cobro del POS, armado por cada negocio desde Configuración → POS
// (ver docs/features/pos-flujo-cobro/feature.md).
//
// Todos los defaults de acá reproducen EXACTAMENTE el flujo fijo que existía
// antes de esta feature: un negocio que nunca entra a Configuración no ve
// ningún cambio.

export const POS_ORDER_TYPES = ["dine_in", "takeaway", "delivery"] as const;
export type PosOrderTypeOption = (typeof POS_ORDER_TYPES)[number];

// "deferred" es el "por cobrar" del selector — no es un método de pago real
// (la orden queda sin pagar y se cobra después), pero ocupa el mismo lugar
// en la UI, así que se configura junto con los demás.
export const POS_PAYMENT_METHODS = ["efectivo", "qr", "mixto", "deferred"] as const;
export type PosPaymentMethodOption = (typeof POS_PAYMENT_METHODS)[number];

// Preseleccionar "mixto" pediría un monto partido antes de que el cajero
// toque nada, y preseleccionar "por cobrar" dejaría toda venta impaga por
// descuido. Solo los dos métodos que cierran la venta solos son elegibles.
export const POS_PRESELECTABLE_PAYMENT_METHODS = ["efectivo", "qr"] as const;
export type PosPreselectablePaymentMethod = (typeof POS_PRESELECTABLE_PAYMENT_METHODS)[number];

export interface PosCheckoutConfig {
  order_types: PosOrderTypeOption[];
  default_order_type: PosOrderTypeOption | null;
  enable_pedidos_ya: boolean;
  payment_methods: PosPaymentMethodOption[];
  default_payment_method: PosPreselectablePaymentMethod | null;
  enable_notes: boolean;
  skip_confirm_step: boolean;
  // Vive en su propia clave (pos_enable_table_number, anterior a esta
  // feature) pero viaja acá: el POS necesita las dos cosas en la misma
  // llamada para no pagar otro round trip al abrir.
  enable_table_number: boolean;
}

export const DEFAULT_POS_CHECKOUT_CONFIG: PosCheckoutConfig = {
  order_types: [...POS_ORDER_TYPES],
  default_order_type: null,
  enable_pedidos_ya: true,
  payment_methods: [...POS_PAYMENT_METHODS],
  default_payment_method: null,
  enable_notes: true,
  skip_confirm_step: false,
  enable_table_number: false,
};

// Con un solo tipo habilitado no hay nada que elegir: el POS lo da por
// seleccionado y esconde la sección entera. Resuelto acá para que el POS y
// el preview de Configuración no puedan discrepar.
export function resolveDefaultOrderType(config: PosCheckoutConfig): PosOrderTypeOption | null {
  if (config.order_types.length === 1) return config.order_types[0];
  if (config.default_order_type && config.order_types.includes(config.default_order_type)) {
    return config.default_order_type;
  }
  return null;
}

export function resolveDefaultPaymentMethod(
  config: PosCheckoutConfig,
): PosPreselectablePaymentMethod | null {
  const method = config.default_payment_method;
  if (method && config.payment_methods.includes(method)) return method;
  return null;
}
