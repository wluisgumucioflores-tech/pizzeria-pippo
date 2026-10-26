"use client";

import { useTranslations } from "next-intl";
import { useOrderStatus } from "../hooks/useOrderStatus";
import { formatLineTotal, formatMoney } from "../lib/money";
import type { OnlineOrderStatus } from "../types/online-orders.types";

interface Props {
  token: string;
  /** Only present right after submitting — a recovered order has no link. */
  whatsappUrl?: string | null;
  /** Forgets a stored order the server no longer knows about. */
  onDiscard: () => void;
  onBrowseMenu: () => void;
}

const BADGE: Record<OnlineOrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-200 text-gray-700",
};

export function OrderStatusView({ token, whatsappUrl, onDiscard, onBrowseMenu }: Props) {
  const t = useTranslations("onlineOrders");
  const { status, loading, refreshing, notFound, error, lastUpdatedAt, refresh } =
    useOrderStatus(token);

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-gray-500">{t("loadingStatus")}</p>;
  }

  // Stored token from a previous day, or an order that no longer exists.
  if (notFound || !status) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-gray-600">{t("orderNotFound")}</p>
        <button
          type="button"
          onClick={onDiscard}
          className="mt-4 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white active:scale-95"
        >
          {t("forgetOrder")}
        </button>
      </div>
    );
  }

  const isPending = status.status === "pending";

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${BADGE[status.status]}`}
        >
          {t(`status.${status.status}`)}
        </span>

        <p className="mt-3 text-sm text-gray-500">{t("orderRef")}</p>
        <p className="text-2xl font-bold tracking-wider text-gray-900">#{status.reference}</p>

        {status.status === "confirmed" && status.daily_number !== null && (
          <p className="mt-3 text-sm text-gray-700">
            {t("ticketNumber")} <strong className="text-lg">{status.daily_number}</strong>
          </p>
        )}

        <p className="mt-3 text-sm text-gray-600">{t(`statusHelp.${status.status}`)}</p>

        {status.status === "rejected" && status.reject_reason && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {status.reject_reason}
          </p>
        )}

        {/* The refresh is a button, not a timer. This screen used to refetch
            every 5s, which with a thousand customers waiting meant ~200 req/s
            against a public endpoint whether anything had changed or not. */}
        {isPending && (
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-semibold text-white active:scale-95 disabled:opacity-60"
            >
              {refreshing ? t("refreshing") : t("refreshStatus")}
            </button>
            {lastUpdatedAt !== null && (
              <p className="mt-2 text-xs text-gray-400">
                {t("lastChecked", { time: formatTime(lastUpdatedAt) })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Only while pending, and only right after submitting: re-offering the
          WhatsApp link once the order is already confirmed would just confuse. */}
      {isPending && whatsappUrl && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">{t("whatsappTitle")}</p>
          <p className="mt-1 text-xs text-emerald-800">{t("whatsappHint")}</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white active:scale-95"
          >
            {t("whatsappButton")}
          </a>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <ul className="space-y-1">
          {status.items.map((item, idx) => (
            <li
              key={`${item.product_name}-${idx}`}
              className="flex justify-between text-sm text-gray-700"
            >
              <span className="truncate pr-2">
                {item.qty}× {item.product_name} {item.variant_name}
              </span>
              <span className="flex-shrink-0 font-medium">
                {formatLineTotal(item.unit_price, item.qty)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
          <span>{t("total")}</span>
          <span>{formatMoney(status.total)}</span>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-amber-700">{t("refreshFailed")}</p>
      )}

      {!isPending && (
        <button
          type="button"
          onClick={onBrowseMenu}
          className="mt-5 w-full rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 active:scale-95"
        >
          {t("orderAgain")}
        </button>
      )}
    </div>
  );
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}
