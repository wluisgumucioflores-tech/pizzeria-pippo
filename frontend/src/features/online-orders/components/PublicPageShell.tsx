"use client";

import { useTranslations } from "next-intl";

const SKELETON_CARDS = [0, 1, 2, 3];

interface Props {
  businessName?: string;
  branchName?: string;
  children: React.ReactNode;
}

// Shared chrome for the public QR page. Plain Tailwind and no antd on purpose:
// this is the only route a customer on a bad connection loads, and Next
// code-splits per route — keeping antd out of it keeps the download small.
export function PublicPageShell({ businessName, branchName, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-100">
      {businessName && (
        // NOT sticky: it used to be `sticky top-0 z-20` while the category
        // headings were `sticky top-0 z-10`, so both pinned to the same point
        // and the category name slid underneath this bar and vanished. It is
        // also pure branding the customer reads once — on a phone those 56px
        // are better spent on the menu, and the search bar pins instead.
        <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <h1 className="text-lg font-bold leading-tight">{businessName}</h1>
            {branchName && <p className="mt-0.5 text-xs text-orange-100">{branchName}</p>}
          </div>
        </header>
      )}
      {/* Centered so the page doesn't stretch edge-to-edge if someone opens
          the link on a laptop instead of scanning the QR with a phone. */}
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

export function PublicPageMessage({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="px-6 py-20 text-center">
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white active:scale-95"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

// Skeleton rather than a line of text: it mirrors the card grid that is about
// to appear, so a slow mobile connection reads as "loading" instead of "empty".
export function PublicPageLoading() {
  const t = useTranslations("onlineOrders");
  return (
    <div className="px-4 py-4">
      <span className="sr-only">{t("loadingMenu")}</span>
      <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {SKELETON_CARDS.map((key) => (
          <li key={key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="aspect-[4/3] w-full animate-pulse bg-gray-200" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
