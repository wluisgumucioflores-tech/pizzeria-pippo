"use client";

import { useTranslations } from "next-intl";
import { formatLineTotal, formatMoney } from "../lib/money";
import { CustomerForm } from "./CustomerForm";
import { QtyStepper } from "./QtyStepper";
import type { CartLine } from "../types/online-orders.types";

interface Props {
  cart: CartLine[];
  total: number;
  submitting: boolean;
  error: string | null;
  onChangeQty: (variantId: string, qty: number) => void;
  onBrowseMenu: () => void;
  onSubmit: (customer: { name: string; phone: string; notes: string }) => void;
}

// The cart is a full tab now, not a sheet sliding up from a sticky bar: the
// bottom nav owns that space, and stacking two fixed bars on a phone was never
// going to fit. Reviewing the cart and filling in the contact details happen on
// one scrolling screen, so there is no "continue" step between them.
export function PublicCartView({
  cart,
  total,
  submitting,
  error,
  onChangeQty,
  onBrowseMenu,
  onSubmit,
}: Props) {
  const t = useTranslations("onlineOrders");

  if (cart.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <p aria-hidden className="text-4xl">
          🛒
        </p>
        <p className="mt-3 text-base font-semibold text-gray-900">{t("emptyCartTitle")}</p>
        <p className="mt-1 text-sm text-gray-500">{t("emptyCartBody")}</p>
        <button
          type="button"
          onClick={onBrowseMenu}
          className="mt-5 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white active:scale-95"
        >
          {t("browseMenu")}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-28">
      <h2 className="text-lg font-bold text-gray-900">{t("cartTitle")}</h2>

      <ul className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {cart.map((line) => (
          <li key={line.variant_id} className="flex items-center gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {line.product_name} {line.variant_name}
              </p>
              <p className="text-xs text-gray-500">
                {formatMoney(line.price)} × {line.qty} = {formatLineTotal(line.price, line.qty)}
              </p>
            </div>
            <QtyStepper
              qty={line.qty}
              onAdd={() => onChangeQty(line.variant_id, line.qty + 1)}
              onRemove={() => onChangeQty(line.variant_id, line.qty - 1)}
            />
          </li>
        ))}

        <li className="flex items-center justify-between bg-gray-50 px-3 py-3 font-bold text-gray-900">
          <span>{t("total")}</span>
          <span>{formatMoney(total)}</span>
        </li>
      </ul>

      <button
        type="button"
        onClick={onBrowseMenu}
        className="mt-3 text-sm font-medium text-orange-600"
      >
        + {t("addMoreProducts")}
      </button>

      <CustomerForm
        total={total}
        submitting={submitting}
        error={error}
        onSubmit={onSubmit}
      />
    </div>
  );
}
