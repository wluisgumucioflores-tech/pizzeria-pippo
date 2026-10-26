import type { PublicMenuProduct } from "../types/online-orders.types";

// Client-side search for the public menu. Deliberately NOT a backend query:
// the whole menu is already loaded, and a customer on a bad connection should
// get instant filtering without another round trip.

/**
 * Lowercases and strips accents so "muzarella" matches "Muzzarella" and
 * "cafe" matches "Café" — customers type without accents on a phone keyboard.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Matches against product name, description, category and variant names, so
 * searching "grande" finds a size and "bebida" finds a whole category.
 * An empty or whitespace-only query returns everything untouched.
 */
export function filterProductsByQuery(
  products: PublicMenuProduct[],
  query: string,
): PublicMenuProduct[] {
  const needle = normalizeText(query.trim());
  if (needle === "") return products;

  return products.filter((product) => {
    const haystack = normalizeText(
      [
        product.name,
        product.description ?? "",
        product.category_name ?? "",
        ...product.variants.map((variant) => variant.name),
      ].join(" "),
    );
    return haystack.includes(needle);
  });
}
