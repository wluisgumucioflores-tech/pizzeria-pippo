// Explicit allowlist of operationIds the AI agent can use as tools. This is
// the main security layer of the AI chat: even if the agent's JWT role could
// technically hit an endpoint, if it's not listed here the agent never even
// learns it exists. Review by hand before adding a new operation — v1 is
// read-only (GET), ToolRegistryService discards any other method even if it
// appears here by mistake.
export const ALLOWED_OPERATIONS: readonly string[] = [
  'StockController_getAlerts',
  'ReportsController_getSales',
  'ReportsController_getTopProducts',
  'PromotionsController_list',
  'ProductsController_list',
];
