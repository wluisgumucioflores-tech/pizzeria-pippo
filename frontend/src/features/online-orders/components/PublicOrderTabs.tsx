"use client";

import { cartCount } from "../lib/cart";
import { PublicBottomNav } from "./PublicBottomNav";
import { PublicCartView } from "./PublicCartView";
import { PublicMenuList } from "./PublicMenuList";
import { PublicOrdersView } from "./PublicOrdersView";
import type { usePublicOrderFlow } from "../hooks/usePublicOrderFlow";
import type { PublicMenu } from "../types/online-orders.types";

interface Props {
  flow: ReturnType<typeof usePublicOrderFlow>;
  menu: PublicMenu;
}

// Renders the active tab plus the bottom nav. Split out of page.tsx purely to
// keep that file inside the project's 100-line budget for pages.
export function PublicOrderTabs({ flow, menu }: Props) {
  const browseMenu = () => flow.setTab("menu");

  return (
    <>
      {flow.tab === "menu" && (
        <PublicMenuList
          products={menu.products}
          cart={flow.cart}
          onAdd={flow.add}
          onChangeQty={flow.changeQty}
        />
      )}

      {flow.tab === "cart" && (
        <PublicCartView
          cart={flow.cart}
          total={flow.total}
          submitting={flow.submitting}
          error={flow.submitError}
          onChangeQty={flow.changeQty}
          onBrowseMenu={browseMenu}
          onSubmit={flow.submit}
        />
      )}

      {flow.tab === "orders" && (
        <PublicOrdersView
          orders={flow.history}
          selectedToken={flow.selectedToken}
          whatsappForToken={
            // The link only exists in the create response, so it is offered
            // for the just-submitted order and nothing else.
            flow.submitted && menu.whatsapp_configured
              ? { token: flow.submitted.public_token, url: flow.submitted.whatsapp_url }
              : null
          }
          onSelect={flow.selectOrder}
          onBackToList={flow.backToList}
          onDiscard={flow.discardOrder}
          onBrowseMenu={browseMenu}
        />
      )}

      <PublicBottomNav
        active={flow.tab}
        cartCount={cartCount(flow.cart)}
        ordersCount={flow.history.length}
        onChange={flow.setTab}
      />
    </>
  );
}
