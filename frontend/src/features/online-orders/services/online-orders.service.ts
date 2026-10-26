import { io, type Socket } from "socket.io-client";
import { getToken } from "@/lib/auth";
import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type {
  ConfirmOnlineOrderResult,
  OnlineOrderCreatedEvent,
  OnlineOrderResolvedEvent,
  OnlineOrderRow,
} from "../types/manage.types";

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL;

type Subscription = { socket: Socket };

// Management side (admin/cajero). Authenticated, unlike
// public-orders.service.ts which backs the customer's own page.
export const OnlineOrdersService = {
  // Returns [] instead of throwing: this feeds a POS tab that renders on
  // every branch change, and a failed fetch must not leave the cashier
  // staring at a spinner (the same bug the day-orders fetch had).
  async list(branchId: string): Promise<OnlineOrderRow[]> {
    try {
      const res = await nestFetch(API_ENDPOINTS.onlineOrders.byBranch(branchId));
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async confirm(id: string): Promise<ConfirmOnlineOrderResult> {
    const res = await nestFetch(API_ENDPOINTS.onlineOrders.confirm(id), {
      method: "POST",
    });
    if (res.ok) return res.json();

    const data = await res.json().catch(() => ({}));
    // 409 is the expected, actionable failure: the request expired, or another
    // cashier already resolved it. The backend's own message says which.
    throw new Error(data.message ?? "No se pudo confirmar el pedido");
  },

  async reject(id: string, reason: string): Promise<void> {
    const res = await nestFetch(API_ENDPOINTS.onlineOrders.reject(id), {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (res.ok) return;

    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "No se pudo rechazar el pedido");
  },

  // Same handshake as the other POS sockets: the gateway resolves the branch
  // room from the JWT, and ignores the branchId a non-admin sends.
  subscribe(
    branchId: string,
    handlers: {
      onCreated: (payload: OnlineOrderCreatedEvent) => void;
      onResolved: (payload: OnlineOrderResolvedEvent) => void;
    },
  ): Subscription {
    const socket: Socket = io(NEST_API_URL, {
      auth: (cb) => {
        getToken().then((token) => cb({ token }));
      },
      query: { branchId },
      transports: ["websocket"],
    });
    socket.on("online-order:created", handlers.onCreated);
    socket.on("online-order:resolved", handlers.onResolved);
    return { socket };
  },

  unsubscribe(subscription: Subscription) {
    subscription.socket.disconnect();
  },
};
