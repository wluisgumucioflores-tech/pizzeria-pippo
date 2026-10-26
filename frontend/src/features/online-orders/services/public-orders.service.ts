import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type {
  CreateOnlineOrderInput,
  CreateOnlineOrderResult,
  OnlineOrderStatusResult,
  PublicMenu,
} from "../types/online-orders.types";

// Distinct from a generic failure: the branch doesn't exist, is inactive, the
// business is suspended, or the module is off. The backend answers all four
// with the same 404 on purpose (it won't let a stranger probe branch ids), so
// the page shows one honest "this menu isn't available" instead of guessing.
export class MenuUnavailableError extends Error {
  constructor() {
    super("Este menú no está disponible");
    this.name = "MenuUnavailableError";
  }
}

// Public QR ordering endpoints — no auth. nestFetch is still used instead of a
// bare fetch: it carries the timeout + GET retry that exist precisely for the
// slow connections this feature was built around. It sends an empty bearer
// token, which the unguarded controller ignores.
export const PublicOrdersService = {
  async getMenu(branchId: string): Promise<PublicMenu> {
    const res = await nestFetch(API_ENDPOINTS.onlineOrders.publicMenu(branchId));
    if (res.status === 404) {
      throw new MenuUnavailableError();
    }
    if (!res.ok) throw new Error("No se pudo cargar el menú");
    return res.json();
  },

  async create(input: CreateOnlineOrderInput): Promise<CreateOnlineOrderResult> {
    const res = await nestFetch(API_ENDPOINTS.onlineOrders.publicCreate, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (res.ok) return res.json();

    // 429 comes from the rate limiter, and the customer can act on it (wait a
    // moment), so it gets its own message instead of a generic failure.
    if (res.status === 429) {
      throw new Error(
        "Demasiados intentos seguidos. Esperá un momento y volvé a enviar el pedido.",
      );
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.message ?? "No se pudo enviar el pedido. Intentá de nuevo.",
    );
  },

  async getStatus(token: string): Promise<OnlineOrderStatusResult | null> {
    const res = await nestFetch(API_ENDPOINTS.onlineOrders.publicStatus(token));
    // A token that no longer resolves isn't an error worth shouting about —
    // the stored one may be from a previous day. null means "start over".
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("No se pudo consultar el estado del pedido");
    return res.json();
  },
};
