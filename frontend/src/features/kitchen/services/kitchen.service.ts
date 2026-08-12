import { io, type Socket } from "socket.io-client";
import { getToken } from "@/lib/auth";
import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { KitchenOrder } from "../types/kitchen.types";

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL;

type OrderUpdatePayload = { new: { id: string; kitchen_status: string; cancelled_at: string | null } };

type OrdersSubscription = { socket: Socket };

export const KitchenService = {
  async getLateThresholdMinutes(): Promise<number | null> {
    const res = await nestFetch(API_ENDPOINTS.settings.kitchenThreshold);
    if (!res.ok) return null;
    const data = await res.json();
    return data.kitchen_late_threshold_minutes ?? null;
  },

  async getBranchName(branchId: string): Promise<string | null> {
    const branches = await BranchesService.getBranches();
    return branches.find((b) => b.id === branchId)?.name ?? null;
  },

  async getPendingOrders(branchId: string): Promise<KitchenOrder[]> {
    const res = await nestFetch(API_ENDPOINTS.orders.kitchen(branchId));
    if (!res.ok) return [];
    return res.json();
  },

  async markOrderReady(orderId: string): Promise<void> {
    await nestFetch(API_ENDPOINTS.orders.ready(orderId), { method: "POST" });
  },

  subscribeToOrders(
    branchId: string,
    onInsert: () => void,
    onUpdate: (payload: OrderUpdatePayload) => void,
    onConnectionChange?: (connected: boolean) => void
  ): OrdersSubscription {
    const socket: Socket = io(NEST_API_URL, {
      auth: (cb) => { getToken().then((token) => cb({ token })); },
      query: { branchId },
      transports: ["websocket"],
    });
    socket.on("order:created", onInsert);
    socket.on("order:updated", (payload: { id: string; kitchen_status: string; cancelled_at: string | null }) => {
      onUpdate({ new: payload });
    });

    // Fase 6 (docs/features/mesero-y-mejoras-pos/) — robustez realtime.
    // socket.io ya reintenta la conexión solo; acá solo exponemos el estado
    // para mostrar un indicador, y re-sincronizamos (onInsert = refetch
    // completo) al reconectar, por si se perdió algún evento mientras
    // estuvo caído.
    let everConnected = false;
    socket.on("connect", () => {
      onConnectionChange?.(true);
      if (everConnected) onInsert();
      everConnected = true;
    });
    socket.on("disconnect", () => onConnectionChange?.(false));

    return { socket };
  },

  unsubscribe(subscription: OrdersSubscription) {
    subscription.socket.disconnect();
  },
};
