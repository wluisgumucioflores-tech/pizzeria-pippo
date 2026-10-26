// Shared constants for the public QR ordering feature (see
// docs/features/pedidos-online-qr/). They live here because the menu mode is
// validated by the backend DTO and rendered by the admin form — the codebase
// already paid the price of duplicating a union like this three times for
// OrderType, so this one starts shared.

// How the admin picks what shows up on the public menu:
//  - all        → every active product of the business
//  - categories → only products whose category is in online_menu_category_ids
//  - products   → only the products listed in online_menu_product_ids
export const ONLINE_MENU_MODES = ["all", "categories", "products"] as const;

export type OnlineMenuMode = (typeof ONLINE_MENU_MODES)[number];

export const DEFAULT_ONLINE_MENU_MODE: OnlineMenuMode = "all";

// Minutes an unattended order survives before it's expired. 30 is a middle
// ground: long enough that a cashier in a rush still gets to it, short enough
// that a customer isn't told "confirmed" an hour after they gave up.
export const DEFAULT_ONLINE_ORDERS_EXPIRE_MINUTES = 30;

// Guard rails for the expiry setting, enforced by the backend DTO. Under 5
// minutes the feature stops being usable (orders vanish before anyone sees
// them); over a day it stops being an expiry at all.
export const MIN_ONLINE_ORDERS_EXPIRE_MINUTES = 5;
export const MAX_ONLINE_ORDERS_EXPIRE_MINUTES = 1440;
