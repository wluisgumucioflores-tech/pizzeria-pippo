"use client";

import { useEffect, useState } from "react";
import { ProductCatalog } from "@/features/pos/components/ProductCatalog";
import { MeseroCartPanel } from "./MeseroCartPanel";
import { MeseroCartDrawer } from "./MeseroCartDrawer";
import { MeseroCartFab } from "./MeseroCartFab";
import { MeseroOrdersList } from "./MeseroOrdersList";
import { useMeseroPage } from "../hooks/useMeseroPage";

export function MeseroPageContent() {
  const p = useMeseroPage();
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (p.tab !== "nuevo") setCartOpen(false);
  }, [p.tab]);

  if (!p.effectiveBranchId) return <div className="p-6 text-center text-gray-400">Cargando...</div>;

  const itemCount = p.cart.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex border-b bg-white">
        <button
          type="button"
          onClick={() => p.setTab("nuevo")}
          className={`flex-1 py-3 text-base font-semibold cursor-pointer ${p.tab === "nuevo" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
        >
          Nuevo pedido
        </button>
        <button
          type="button"
          onClick={() => p.setTab("mis-pedidos")}
          className={`flex-1 py-3 text-base font-semibold cursor-pointer ${p.tab === "mis-pedidos" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
        >
          Mis pedidos
        </button>
      </div>

      {!p.connected && (
        <div className="mx-4 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-md text-base text-red-700 animate-pulse">
          🔴 Sin conexión — reconectando...
        </div>
      )}

      {p.submitError && (
        <div className="mx-4 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-md text-base text-red-700">
          {p.submitError}
        </div>
      )}

      {p.tab === "nuevo" && p.addingToOrder && (
        <div className="mx-4 mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-base text-blue-700 flex items-center justify-between">
          <span>Agregando items al pedido #{String(p.addingToOrder.dailyNumber).padStart(2, "0")}</span>
          <button type="button" onClick={p.cancelAddItems} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
            Cancelar
          </button>
        </div>
      )}

      {p.tab === "nuevo" ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
          <div className="overflow-y-auto">
            <ProductCatalog
              products={p.products}
              loading={p.loadingProducts}
              branchId={p.effectiveBranchId}
              useStock={p.useStock}
              getVariantPrice={p.getVariantPrice}
              getPromoLabel={() => null}
              onProductClick={p.handleProductClick}
              large
            />
          </div>
          <div className="hidden lg:flex lg:flex-col overflow-hidden bg-white rounded-lg shadow">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-gray-800">Pedido</span>
              <span className="text-gray-400">🛒</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <MeseroCartPanel cart={p.cart} submitting={p.submitting} extraOptions={p.extraOptions} addingToOrder={p.addingToOrder} onSubmit={p.handleSubmitOrder} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <MeseroOrdersList orders={p.myOrders} loading={p.loadingOrders} onAddItems={p.startAddItems} />
        </div>
      )}

      {p.tab === "nuevo" && (
        <>
          <MeseroCartFab itemCount={itemCount} onClick={() => setCartOpen(true)} />
          <MeseroCartDrawer open={cartOpen} onClose={() => setCartOpen(false)}>
            <MeseroCartPanel cart={p.cart} submitting={p.submitting} extraOptions={p.extraOptions} addingToOrder={p.addingToOrder} onSubmit={p.handleSubmitOrder} />
          </MeseroCartDrawer>
        </>
      )}
    </div>
  );
}
