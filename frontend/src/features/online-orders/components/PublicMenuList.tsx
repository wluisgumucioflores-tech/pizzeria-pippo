"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { groupIntoSections, isCartFull } from "../lib/cart";
import { filterProductsByQuery } from "../lib/menu-search";
import { SEARCH_MIN_PRODUCTS } from "../constants/online-orders.constants";
import { PublicMenuSearch } from "./PublicMenuSearch";
import { PublicProductCard } from "./PublicProductCard";
import type {
  CartLine,
  PublicMenuProduct,
  PublicMenuVariant,
} from "../types/online-orders.types";

interface Props {
  products: PublicMenuProduct[];
  cart: CartLine[];
  onAdd: (product: PublicMenuProduct, variant: PublicMenuVariant) => void;
  onChangeQty: (variantId: string, qty: number) => void;
}

export function PublicMenuList({ products, cart, onAdd, onChangeQty }: Props) {
  const t = useTranslations("onlineOrders");
  // Search lives here rather than in usePublicOrderFlow: it is pure view state
  // and never leaves this screen.
  const [query, setQuery] = useState("");

  const visible = useMemo(() => filterProductsByQuery(products, query), [products, query]);
  const sections = useMemo(
    () => groupIntoSections(visible, t("uncategorized")),
    [visible, t],
  );

  const qtyByVariant = new Map(cart.map((line) => [line.variant_id, line.qty]));
  const cartFull = isCartFull(cart);
  const showSearch = products.length > SEARCH_MIN_PRODUCTS;
  // Category headings stick right below the search bar, or at the very top
  // when there is no search bar — otherwise they would float over a 56px gap.
  const headingOffset = showSearch ? "top-14" : "top-0";

  if (products.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-gray-500">{t("emptyMenu")}</p>;
  }

  return (
    <div>
      {showSearch && <PublicMenuSearch value={query} onChange={setQuery} />}

      {visible.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-gray-600">{t("noResults", { query: query.trim() })}</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-4 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 active:scale-95"
          >
            {t("clearSearch")}
          </button>
        </div>
      ) : (
        // Clears the fixed bottom nav, which is always present — without this
        // the last row of cards sits underneath it and can't be reached.
        <div className="pb-24">
          {sections.map((section) => (
            <section key={section.category_id}>
              <h2
                className={`sticky ${headingOffset} z-10 bg-gray-100/95 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-600 backdrop-blur`}
              >
                {section.category_name}
              </h2>

              {/* Two columns on a phone (the QR audience); more on a wider
                  screen so the cards don't stretch into billboards. */}
              <ul className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.products.map((product) => (
                  <PublicProductCard
                    key={product.id}
                    product={product}
                    qtyByVariant={qtyByVariant}
                    cartFull={cartFull}
                    onAdd={onAdd}
                    onChangeQty={onChangeQty}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
