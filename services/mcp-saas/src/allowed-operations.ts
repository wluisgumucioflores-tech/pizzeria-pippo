// Explicit allowlist of OpenAPI operationIds exposed as MCP tools. v1 is
// read-only — ToolRegistry discards any operation whose HTTP method isn't
// GET even if it somehow appears here.
export const ALLOWED_OPERATIONS: readonly string[] = [
  'ProductsController_list',
  'ReportsController_getSales',
  'ReportsController_getTopProducts',
  'ReportsController_getDaily',
  'ReportsController_getCashiers',
  'ReportsController_getOrders',
];
