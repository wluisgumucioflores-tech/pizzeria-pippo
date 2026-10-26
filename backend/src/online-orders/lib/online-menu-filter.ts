import type { OnlineMenuMode } from '@pippo/shared';

// Decides which products the admin chose to expose on the public QR menu
// (Configuración → Pedidos online). Pure, so the rule is testable on its own
// and the same function gates BOTH the menu listing and the order submission
// — otherwise a customer could order a product that the menu never showed by
// posting its variant id directly.

export interface MenuVisibilityConfig {
  mode: OnlineMenuMode;
  categoryIds: string[];
  productIds: string[];
}

export interface FilterableProduct {
  id: string;
  categoryId: string | null;
}

export function isProductVisibleOnline(
  product: FilterableProduct,
  config: MenuVisibilityConfig,
): boolean {
  switch (config.mode) {
    case 'all':
      return true;
    case 'categories':
      // A product with no category can never match a category selection.
      return (
        product.categoryId !== null &&
        config.categoryIds.includes(product.categoryId)
      );
    case 'products':
      return config.productIds.includes(product.id);
    default:
      // Unreachable while OnlineMenuMode stays a closed union, but if a new
      // mode is ever added, failing closed (hide) beats leaking the whole
      // catalogue onto a public page.
      return false;
  }
}

export function filterVisibleProducts<T extends FilterableProduct>(
  products: T[],
  config: MenuVisibilityConfig,
): T[] {
  return products.filter((product) => isProductVisibleOnline(product, config));
}
