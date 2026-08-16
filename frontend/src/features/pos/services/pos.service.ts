import { io, type Socket } from "socket.io-client";
import { getToken as _getToken, getUserProfile, signOut } from "@/lib/auth";
import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { todayInBolivia } from "@/lib/timezone";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { Identity, Product, DayOrder, OrderType, PaymentMethod, SplitPayment } from "../types/pos.types";
import type { Promotion, DiscountedItem, FlavorItem } from "@/lib/promotions";

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL;

type KitchenStatusSubscription = { socket: Socket };

export const PosService = {
  async getToken(): Promise<string> {
    return _getToken();
  },

  async getBranches(): Promise<{ id: string; name: string }[]> {
    const branches = await BranchesService.getBranches();
    return branches
      .map((b) => ({ id: b.id, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async logout(): Promise<void> {
    await signOut();
  },

  async getIdentity(): Promise<Identity | null> {
    const profile = await getUserProfile();
    if (!profile) return null;
    return {
      id: profile.id,
      name: profile.full_name ?? profile.email,
      role: profile.role,
      branch_id: profile.branch_id,
    };
  },

  async getProductsAndPromotions(branchId: string): Promise<{ products: Product[]; promotions: Promotion[]; useStock: boolean; enableTableNumber: boolean }> {
    const today = todayInBolivia();
    const [productsRes, promoRes, stockRes, tableNumberRes] = await Promise.all([
      nestFetch(API_ENDPOINTS.products.posCatalog(branchId)),
      nestFetch(API_ENDPOINTS.promotions.forPos(branchId, today)),
      nestFetch(API_ENDPOINTS.settings.stock),
      nestFetch(API_ENDPOINTS.settings.posTableNumber),
    ]);
    const [productsData, promoData, stockData, tableNumberData] = await Promise.all([productsRes.json(), promoRes.json(), stockRes.json(), tableNumberRes.json()]);
    return {
      products: Array.isArray(productsData) ? productsData : [],
      promotions: Array.isArray(promoData) ? promoData : [],
      useStock: stockRes.ok ? stockData.use_stock !== false : true,
      enableTableNumber: tableNumberRes.ok ? tableNumberData.pos_enable_table_number === true : false,
    };
  },

  async getDayOrders(branchId: string): Promise<DayOrder[]> {
    const res = await nestFetch(API_ENDPOINTS.orders.byBranch(branchId));
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async confirmSale(
    branchId: string,
    discountedCart: DiscountedItem[],
    total: number,
    paymentMethod: PaymentMethod,
    paymentProvider: string | null,
    orderType: OrderType,
    signal?: AbortSignal,
    idempotencyKey?: string,
    payments?: SplitPayment[],
    notes?: string | null,
    tableNumber?: string | null,
    waiterName?: string | null
  ): Promise<{ ok: boolean; order_id?: string; daily_number?: number; error?: string }> {
    try {
      const res = await nestFetch(API_ENDPOINTS.orders.base, {
        method: "POST",
        signal,
        body: JSON.stringify({
          branch_id: branchId,
          total,
          payment_method: paymentMethod,
          payment_provider: paymentProvider,
          payments: payments ?? null,
          order_type: orderType,
          table_number: tableNumber?.trim() || null,
          waiter_name: waiterName?.trim() || null,
          notes: notes?.trim() || null,
          idempotency_key: idempotencyKey ?? null,
          // The server recalculates prices, promos and physical units from
          // qty (paid units) — client-side amounts are only used to verify
          items: discountedCart.map((i) => ({
            variant_id: i.variant_id,
            qty: i.qty,
            flavors: (i.flavors as FlavorItem[] | undefined) ?? null,
            promo_id: i.promo_id ?? null,
            unit_price: i.price_edited ? i.unit_price : undefined,
          })),
        }),
      });
      if (res.ok) {
        const { order_id, daily_number } = await res.json();
        return { ok: true, order_id, daily_number };
      }
      const { error } = await res.json();
      return { ok: false, error };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, error: "La solicitud fue cancelada (sin conexión o tiempo agotado)." };
      }
      return { ok: false, error: "Sin conexión. Verificá el internet e intentá de nuevo." };
    }
  },

  // Agregar items a un pedido existente — funciona tanto si sigue pendiente
  // como si cocina ya lo marcó "listo" (se reabre, ver orders.service.ts).
  async addItemsToOrder(
    orderId: string,
    discountedCart: DiscountedItem[],
    total: number
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.orders.addItems(orderId), {
      method: "POST",
      body: JSON.stringify({
        total,
        items: discountedCart.map((i) => ({
          variant_id: i.variant_id,
          qty: i.qty,
          flavors: (i.flavors as FlavorItem[] | undefined) ?? null,
          promo_id: i.promo_id ?? null,
          unit_price: i.price_edited ? i.unit_price : undefined,
        })),
      }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Error al agregar items al pedido" };
  },

  async markOrderReady(orderId: string): Promise<void> {
    await nestFetch(API_ENDPOINTS.orders.ready(orderId), { method: "POST" });
  },

  subscribeToKitchenStatus(
    branchId: string,
    onUpdate: (payload: { new: { id: string; kitchen_status: string; payment_method?: string | null } }) => void,
    onInsert?: () => void,
    onConnectionChange?: (connected: boolean) => void
  ): KitchenStatusSubscription {
    const socket: Socket = io(NEST_API_URL, {
      auth: (cb) => { PosService.getToken().then((token) => cb({ token })); },
      query: { branchId },
      transports: ["websocket"],
    });
    socket.on("order:updated", (payload: { id: string; kitchen_status: string; payment_method?: string | null }) => {
      onUpdate({ new: payload });
    });
    if (onInsert) socket.on("order:created", onInsert);

    // Fase 6 — robustez realtime, mismo patrón que KitchenService.subscribeToOrders.
    let everConnected = false;
    socket.on("connect", () => {
      onConnectionChange?.(true);
      if (everConnected) onInsert?.();
      everConnected = true;
    });
    socket.on("disconnect", () => onConnectionChange?.(false));

    return { socket };
  },

  unsubscribe(subscription: KitchenStatusSubscription) {
    subscription.socket.disconnect();
  },

  async cancelOrder(orderId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.orders.cancel(orderId), { method: "POST", body: JSON.stringify({ reason }) });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Error al anular la orden" };
  },

  // Fase 4 (docs/features/mesero-y-mejoras-pos/) — cobro diferido: cobra una
  // orden que se creó sin método de pago (ej. creada por un mesero).
  async payOrder(
    orderId: string,
    paymentMethod: PaymentMethod,
    paymentProvider: string | null,
    payments: SplitPayment[] | null
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.orders.pay(orderId), {
      method: "POST",
      body: JSON.stringify({
        payment_method: payments ? "mixto" : paymentMethod,
        payment_provider: paymentProvider,
        payments: payments ?? null,
      }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Error al cobrar la orden" };
  },
};
