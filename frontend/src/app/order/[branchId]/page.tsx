"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePublicOrderFlow } from "@/features/online-orders/hooks/usePublicOrderFlow";
import { PublicOrderTabs } from "@/features/online-orders/components/PublicOrderTabs";
import {
  PublicPageLoading,
  PublicPageMessage,
  PublicPageShell,
} from "@/features/online-orders/components/PublicPageShell";

// Public QR ordering page — ver docs/features/pedidos-online-qr/.
// Deliberately OUTSIDE the (admin)/(pos)/(superadmin) route groups: those have
// auth guards in their layouts, and this page must load with no session.
export default function OrderPage() {
  const params = useParams();
  const branchId = typeof params.branchId === "string" ? params.branchId : "";
  const t = useTranslations("onlineOrders");
  const flow = usePublicOrderFlow(branchId);

  if (flow.loading) {
    return (
      <PublicPageShell>
        <PublicPageLoading />
      </PublicPageShell>
    );
  }

  if (flow.unavailable) {
    return (
      <PublicPageShell>
        <PublicPageMessage title={t("unavailableTitle")} body={t("unavailableBody")} />
      </PublicPageShell>
    );
  }

  if (flow.loadError || !flow.menu) {
    return (
      <PublicPageShell>
        <PublicPageMessage
          title={t("loadErrorTitle")}
          body={t("loadErrorBody")}
          onRetry={flow.retryLoad}
          retryLabel={t("retry")}
        />
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell
      businessName={flow.menu.business_name}
      branchName={flow.menu.branch_name}
    >
      <PublicOrderTabs flow={flow} menu={flow.menu} />
    </PublicPageShell>
  );
}
