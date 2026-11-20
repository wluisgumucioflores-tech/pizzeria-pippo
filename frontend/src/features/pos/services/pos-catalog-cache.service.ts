import { STORE, dbGet, dbPut } from "@/lib/offline-db";
import { DEFAULT_POS_CHECKOUT_CONFIG, type PosCheckoutConfig } from "@pippo/shared";
import type { Product } from "../types/pos.types";
import type { Promotion } from "@/lib/promotions";

// How long a cached catalog counts as fresh. Past this it is still served —
// stale prices beat an empty POS that cannot sell at all — but the UI is told
// so it can warn the cashier.
const FRESH_FOR_MS = 5 * 60 * 1000;

export interface CachedCatalog {
  branchId: string;
  cachedAt: number;
  products: Product[];
  promotions: Promotion[];
  useStock: boolean;
  checkout: PosCheckoutConfig;
}

export const PosCatalogCache = {
  async read(branchId: string): Promise<{ catalog: CachedCatalog; isStale: boolean } | null> {
    try {
      const catalog = await dbGet<CachedCatalog>(STORE.catalog, branchId);
      if (!catalog?.products?.length) return null;
      // Una entrada guardada por una versión anterior no tiene `checkout`
      // (antes acá vivía un solo booleano de número de mesa). Se sirve igual
      // con el flujo de cobro por defecto hasta que el refresh la reemplace.
      const safe = catalog.checkout ? catalog : { ...catalog, checkout: DEFAULT_POS_CHECKOUT_CONFIG };
      return { catalog: safe, isStale: Date.now() - catalog.cachedAt > FRESH_FOR_MS };
    } catch {
      // No IndexedDB (private mode, blocked storage) — behave as a cold start.
      return null;
    }
  },

  async write(entry: Omit<CachedCatalog, "cachedAt">): Promise<void> {
    try {
      await dbPut(STORE.catalog, entry.branchId, { ...entry, cachedAt: Date.now() });
    } catch {
      // Quota exceeded or storage unavailable — the POS works without a cache.
    }
  },
};
