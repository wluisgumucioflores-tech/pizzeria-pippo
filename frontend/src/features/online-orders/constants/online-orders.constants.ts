// NOTE: there is deliberately no poll interval any more. The waiting screen
// used to refetch every 5s, which meant ~200 req/s against the public endpoint
// with a thousand customers waiting — a cost paid whether anything changed or
// not. It now refreshes on open, on a button tap, and when the tab regains
// focus (which covers the WhatsApp round-trip). See useOrderStatus.

// The customer's order history, kept in their browser. There is no customer
// account in the system — the public token is the only credential — so this is
// the only place it can live. Scoped per branch: a customer who orders at two
// branches keeps both lists.
export const orderHistoryStorageKey = (branchId: string) =>
  `pippo_online_orders_${branchId}`;

// Pre-history key, which held a single token. Read once and deleted by
// lib/order-history.ts so an in-flight order survives the upgrade.
export const legacyTokenStorageKey = (branchId: string) =>
  `pippo_online_order_${branchId}`;

// A customer has no use for a list going back weeks, and an order older than
// this is already resolved or expired server-side — keeping it would only show
// rows that resolve to "no encontramos tu pedido".
export const MAX_STORED_ORDERS = 10;
export const ORDER_HISTORY_TTL_DAYS = 2;

// Nothing stops a customer from adding 99 of something, but a public form with
// no ceiling is an invitation. Mirrors the backend DTO's own limits
// (MAX_QTY_PER_LINE / MAX_ITEMS_PER_PUBLIC_ORDER) so the UI blocks what the
// server would reject anyway — one less confusing 400.
export const MAX_QTY_PER_LINE = 50;
export const MAX_LINES_PER_ORDER = 30;

// Same rule the backend DTO enforces, checked here so the customer sees the
// error before submitting.
export const CUSTOMER_PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
export const CUSTOMER_NAME_MIN = 2;
export const CUSTOMER_NAME_MAX = 60;
export const CUSTOMER_NOTES_MAX = 300;

// Products with no category still have to land somewhere in the menu.
export const UNCATEGORIZED_ID = "__sin_categoria__";

// Below this many products the whole menu fits in a couple of scrolls and a
// search box is just a field taking up the top of the screen.
export const SEARCH_MIN_PRODUCTS = 8;

// antd Tag colours for the admin history. Confirmed is the only "good"
// outcome; expired is grey rather than red because nobody did anything wrong,
// the request just went unattended.
export const STATUS_TAG_COLOR: Record<string, string> = {
  pending: "gold",
  confirmed: "green",
  rejected: "red",
  expired: "default",
};
