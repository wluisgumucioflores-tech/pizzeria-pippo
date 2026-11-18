// Set fijo por ahora — ver docs/features/cashbox/feature.md. Si el negocio
// necesita categorías propias más adelante, esto pasa a configuración por
// negocio en vez de agrandarse acá.
export const CASH_EXPENSE_CATEGORIES = ['insumos', 'mantenimiento', 'transporte', 'otro'] as const;

export type CashExpenseCategory = (typeof CASH_EXPENSE_CATEGORIES)[number];
