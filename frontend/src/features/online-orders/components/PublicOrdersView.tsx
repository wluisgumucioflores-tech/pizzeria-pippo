"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "../lib/money";
import { OrderStatusView } from "./OrderStatusView";
import type { StoredOrder } from "../types/online-orders.types";

interface Props {
  orders: StoredOrder[];
  selectedToken: string | null;
  /** Only for the order just submitted — a recovered one has no WhatsApp link. */
  whatsappForToken: { token: string; url: string } | null;
  onSelect: (token: string) => void;
  onBackToList: () => void;
  onDiscard: (token: string) => void;
  onBrowseMenu: () => void;
}

export function PublicOrdersView({
  orders,
  selectedToken,
  whatsappForToken,
  onSelect,
  onBackToList,
  onDiscard,
  onBrowseMenu,
}: Props) {
  const t = useTranslations("onlineOrders");

  if (selectedToken !== null) {
    return (
      <div className="pb-28">
        {orders.length > 1 && (
          <button
            type="button"
            onClick={onBackToList}
            className="px-4 pt-4 text-sm font-medium text-orange-600"
          >
            ← {t("backToOrders")}
          </button>
        )}
        <OrderStatusView
          token={selectedToken}
          whatsappUrl={
            whatsappForToken?.token === selectedToken ? whatsappForToken.url : null
          }
          onDiscard={() => onDiscard(selectedToken)}
          onBrowseMenu={onBrowseMenu}
        />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <p aria-hidden className="text-4xl">
          🧾
        </p>
        <p className="mt-3 text-base font-semibold text-gray-900">{t("emptyOrdersTitle")}</p>
        <p className="mt-1 text-sm text-gray-500">{t("emptyOrdersBody")}</p>
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
      <h2 className="text-lg font-bold text-gray-900">{t("ordersTitle")}</h2>
      <p className="mt-1 text-sm text-gray-500">{t("ordersHint")}</p>

      <ul className="mt-3 space-y-2">
        {orders.map((order) => (
          <li key={order.token}>
            <button
              type="button"
              onClick={() => onSelect(order.token)}
              className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {order.reference === "" ? t("orderRef") : `#${order.reference}`}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatOrderDate(order.created_at)}
                </p>
              </div>
              {/* A migrated entry has no stored total — showing "Bs 0.00"
                  would be a lie, so it shows nothing until opened. */}
              {order.total > 0 && (
                <span className="flex-shrink-0 text-sm font-bold text-gray-900">
                  {formatMoney(order.total)}
                </span>
              )}
              <span aria-hidden className="flex-shrink-0 text-gray-400">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Time only — the history never holds anything older than a couple of days. */
function formatOrderDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
