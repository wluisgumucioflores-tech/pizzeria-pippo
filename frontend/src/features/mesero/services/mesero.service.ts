import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { MeseroCartItem } from "../types/mesero.types";

export const MeseroService = {
  async createOrder(params: {
    branchId: string;
    items: MeseroCartItem[];
    total: number;
    orderType: string;
    tableNumber: string | null;
    waiterName: string;
    idempotencyKey: string;
  }): Promise<{ ok: boolean; order_id?: string; daily_number?: number; error?: string }> {
    try {
      const res = await nestFetch(API_ENDPOINTS.orders.base, {
        method: "POST",
        body: JSON.stringify({
          branch_id: params.branchId,
          total: params.total,
          order_type: params.orderType,
          table_number: params.tableNumber,
          waiter_name: params.waiterName,
          idempotency_key: params.idempotencyKey,
          items: params.items.map((i) => ({
            variant_id: i.variant_id,
            qty: i.qty,
            extras: i.extras.length ? i.extras : undefined,
          })),
        }),
      });
      if (res.ok) {
        const { order_id, daily_number } = await res.json();
        return { ok: true, order_id, daily_number };
      }
      const { error } = await res.json();
      return { ok: false, error };
    } catch {
      return { ok: false, error: "Sin conexión. Verificá el internet e intentá de nuevo." };
    }
  },
};
