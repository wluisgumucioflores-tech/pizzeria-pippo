import { MAX_LINES_PER_ORDER, MAX_QTY_PER_LINE, UNCATEGORIZED_ID } from "../constants/online-orders.constants";
import type {
  CartLine,
  MenuSection,
  PublicMenuProduct,
  PublicMenuVariant,
} from "../types/online-orders.types";

// Pure cart + menu-grouping logic for the public QR page. Kept out of the hook
// so it's testable without React — and because the totals shown here must
// match what the server computes, which is worth pinning down with tests.
//
// Note: this total is for DISPLAY only. The server never trusts it (the
// create DTO has no `total` field at all) and recomputes from branch_prices.

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cartTotal(lines: CartLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.price * line.qty, 0));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

/** Immutable: returns a new array, so React state updates stay predictable. */
export function addToCart(
  lines: CartLine[],
  product: PublicMenuProduct,
  variant: PublicMenuVariant,
): CartLine[] {
  const existing = lines.find((line) => line.variant_id === variant.id);

  if (existing) {
    // Already in the cart — bump quantity, capped. Silently capping beats
    // throwing: the customer just can't go higher.
    return lines.map((line) =>
      line.variant_id === variant.id
        ? { ...line, qty: Math.min(MAX_QTY_PER_LINE, line.qty + 1) }
        : line,
    );
  }

  if (lines.length >= MAX_LINES_PER_ORDER) return lines;

  return [
    ...lines,
    {
      variant_id: variant.id,
      product_name: product.name,
      variant_name: variant.name,
      price: variant.price,
      qty: 1,
    },
  ];
}

/** Setting a quantity to 0 (or below) removes the line entirely. */
export function setQty(
  lines: CartLine[],
  variantId: string,
  qty: number,
): CartLine[] {
  if (qty <= 0) return lines.filter((line) => line.variant_id !== variantId);
  return lines.map((line) =>
    line.variant_id === variantId
      ? { ...line, qty: Math.min(MAX_QTY_PER_LINE, qty) }
      : line,
  );
}

export function isCartFull(lines: CartLine[]): boolean {
  return lines.length >= MAX_LINES_PER_ORDER;
}

// Groups the flat product list into the sections the menu renders. The backend
// already sorts products by name; this preserves that order within each
// section and orders the sections by first appearance, so the menu doesn't
// reshuffle between loads.
export function groupIntoSections(
  products: PublicMenuProduct[],
  uncategorizedLabel: string,
): MenuSection[] {
  const sections = new Map<string, MenuSection>();

  for (const product of products) {
    const id = product.category_id ?? UNCATEGORIZED_ID;
    const name = product.category_name ?? uncategorizedLabel;
    const section = sections.get(id);
    if (section) {
      section.products.push(product);
    } else {
      sections.set(id, { category_id: id, category_name: name, products: [product] });
    }
  }

  return Array.from(sections.values());
}
