"use client";

import { useTranslations } from "next-intl";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

// Sticky so it stays reachable in a long menu. Its height is fixed (h-14) on
// purpose: the category headings stick directly underneath at top-14, and a
// variable height there would let them slide under it — the same collision the
// old layout had between the page header and the category headings.
export function PublicMenuSearch({ value, onChange }: Props) {
  const t = useTranslations("onlineOrders");

  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-4">
      <span aria-hidden className="text-gray-400">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        // text-base (16px) keeps iOS Safari from zooming in on focus.
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-gray-400"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex-shrink-0 text-sm font-medium text-orange-600"
        >
          {t("clearSearch")}
        </button>
      )}
    </div>
  );
}
