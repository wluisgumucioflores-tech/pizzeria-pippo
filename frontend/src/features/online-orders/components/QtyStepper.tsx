"use client";

import { useTranslations } from "next-intl";

interface Props {
  qty: number;
  disabled?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

// Collapses to a single round + until the product is in the cart, then expands
// into − qty +. Previously the menu could only ADD: to lower a quantity the
// customer had to open the cart sheet and find the line again.
//
// Targets are 32px so two fit next to a price inside a half-width card while
// staying tappable with a thumb.
export function QtyStepper({ qty, disabled = false, onAdd, onRemove }: Props) {
  const t = useTranslations("onlineOrders");

  if (qty === 0) {
    return (
      <button
        type="button"
        aria-label={t("increase")}
        disabled={disabled}
        onClick={onAdd}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-xl leading-none text-white transition active:scale-90 disabled:bg-gray-200 disabled:text-gray-400"
      >
        +
      </button>
    );
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-orange-50 p-0.5 ring-1 ring-orange-200">
      <button
        type="button"
        aria-label={t("decrease")}
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-orange-700 active:scale-90"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-bold text-orange-700">{qty}</span>
      <button
        type="button"
        aria-label={t("increase")}
        onClick={onAdd}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-lg leading-none text-white active:scale-90"
      >
        +
      </button>
    </div>
  );
}
