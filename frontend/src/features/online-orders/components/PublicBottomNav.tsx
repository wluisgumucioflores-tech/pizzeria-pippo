"use client";

import { useTranslations } from "next-intl";
import type { PublicTab } from "../types/online-orders.types";

interface Props {
  active: PublicTab;
  /** Units in the cart — shown as a badge, hidden at 0. */
  cartCount: number;
  /**
   * Recent orders saved in this browser. Deliberately a plain count and not
   * "pending only": knowing which are pending would mean one request per
   * stored order on every render, which is the cost this screen just removed.
   */
  ordersCount: number;
  onChange: (tab: PublicTab) => void;
}

const TABS: { key: PublicTab; icon: string }[] = [
  { key: "menu", icon: "🍽️" },
  { key: "cart", icon: "🛒" },
  { key: "orders", icon: "🧾" },
];

// Emoji rather than an icon library on purpose: this route deliberately ships
// no antd and no icon package, so a customer on a bad connection downloads as
// little as possible.
//
// pb-safe keeps the bar clear of the iOS/Android gesture bar.
export function PublicBottomNav({ active, cartCount, ordersCount, onChange }: Props) {
  const t = useTranslations("onlineOrders");

  const badgeFor = (tab: PublicTab): number =>
    tab === "cart" ? cartCount : tab === "orders" ? ordersCount : 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl border-t border-gray-200 bg-white pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
      <ul className="flex">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const badge = badgeFor(tab.key);
          return (
            <li key={tab.key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 transition ${
                  isActive ? "text-orange-600" : "text-gray-500"
                }`}
              >
                <span aria-hidden className="text-xl leading-none">
                  {tab.icon}
                </span>
                <span className={`text-[11px] ${isActive ? "font-bold" : "font-medium"}`}>
                  {t(`tabs.${tab.key}`)}
                </span>

                {badge > 0 && (
                  <span className="absolute right-[22%] top-1 min-w-[18px] rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-[18px] text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}

                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-orange-500"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
