import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { appendOrder, readOrderHistory, removeOrder } from "./order-history";
import {
  MAX_STORED_ORDERS,
  legacyTokenStorageKey,
  orderHistoryStorageKey,
} from "../constants/online-orders.constants";
import type { StoredOrder } from "../types/online-orders.types";

const BRANCH = "br-1";
const KEY = orderHistoryStorageKey(BRANCH);

const order = (token: string, minutesAgo = 0): StoredOrder => ({
  token,
  reference: token.toUpperCase(),
  total: 100,
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

// Vitest runs this project in the `node` environment (see vitest.config.ts),
// so there is no localStorage. An in-memory stub beats pulling in jsdom just
// for this file — and beats switching the whole suite to a DOM environment.
class MemoryStorage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);

beforeEach(() => {
  storage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readOrderHistory", () => {
  it("devuelve vacío si no hay nada guardado", () => {
    expect(readOrderHistory(BRANCH)).toEqual([]);
  });

  it("devuelve los pedidos guardados, del más nuevo al más viejo", () => {
    storage.setItem(KEY, JSON.stringify([order("a", 30), order("b", 5)]));
    expect(readOrderHistory(BRANCH).map((o) => o.token)).toEqual(["b", "a"]);
  });

  // El localStorage lo puede tocar cualquiera y un JSON roto no puede tumbar
  // la única pantalla que ve el cliente.
  it("degrada a vacío con JSON corrupto", () => {
    storage.setItem(KEY, "{no es json");
    expect(readOrderHistory(BRANCH)).toEqual([]);
  });

  it("descarta entradas con forma inválida pero conserva las buenas", () => {
    storage.setItem(
      KEY,
      JSON.stringify([order("ok"), { token: 123 }, null, "x", { reference: "sin token" }]),
    );
    expect(readOrderHistory(BRANCH).map((o) => o.token)).toEqual(["ok"]);
  });

  // Un pedido viejo ya no existe en el servidor: mostrarlo solo produciría
  // filas que al abrirlas dicen "no encontramos tu pedido".
  it("descarta pedidos más viejos que el TTL", () => {
    const threeDays = 3 * 24 * 60;
    storage.setItem(KEY, JSON.stringify([order("viejo", threeDays), order("nuevo", 1)]));
    expect(readOrderHistory(BRANCH).map((o) => o.token)).toEqual(["nuevo"]);
  });

  it("descarta una fecha inválida en vez de tratarla como reciente", () => {
    storage.setItem(KEY, JSON.stringify([{ ...order("x"), created_at: "no-es-fecha" }]));
    expect(readOrderHistory(BRANCH)).toEqual([]);
  });

  it("no pasa del máximo de pedidos guardados", () => {
    const many = Array.from({ length: MAX_STORED_ORDERS + 5 }, (_, i) => order(`t${i}`, i));
    storage.setItem(KEY, JSON.stringify(many));
    expect(readOrderHistory(BRANCH)).toHaveLength(MAX_STORED_ORDERS);
  });

  // Si localStorage tira (modo privado de algunos navegadores), la página
  // igual tiene que renderizar.
  it("devuelve vacío si localStorage explota", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readOrderHistory(BRANCH)).toEqual([]);
  });
});

describe("migración de la clave vieja", () => {
  // La versión anterior guardaba un solo token en otra clave. Un cliente con
  // un pedido en curso no lo tiene que perder al actualizar.
  it("convierte el token viejo en una entrada y borra la clave", () => {
    storage.setItem(legacyTokenStorageKey(BRANCH), "token-viejo");

    const result = readOrderHistory(BRANCH);

    expect(result.map((o) => o.token)).toEqual(["token-viejo"]);
    expect(storage.getItem(legacyTokenStorageKey(BRANCH))).toBeNull();
  });

  it("no duplica si el token viejo ya está en la lista nueva", () => {
    storage.setItem(KEY, JSON.stringify([order("dup")]));
    storage.setItem(legacyTokenStorageKey(BRANCH), "dup");

    expect(readOrderHistory(BRANCH).map((o) => o.token)).toEqual(["dup"]);
  });
});

describe("appendOrder", () => {
  it("pone el pedido nuevo primero y lo persiste", () => {
    appendOrder(BRANCH, order("viejo", 10));
    const result = appendOrder(BRANCH, order("nuevo"));

    expect(result.map((o) => o.token)).toEqual(["nuevo", "viejo"]);
    expect(readOrderHistory(BRANCH).map((o) => o.token)).toEqual(["nuevo", "viejo"]);
  });

  it("reemplaza en vez de duplicar si el token ya estaba", () => {
    appendOrder(BRANCH, order("mismo"));
    expect(appendOrder(BRANCH, order("mismo"))).toHaveLength(1);
  });

  it("no tira si no se puede escribir", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => appendOrder(BRANCH, order("x"))).not.toThrow();
  });
});

describe("removeOrder", () => {
  it("saca solo el pedido indicado", () => {
    appendOrder(BRANCH, order("a", 10));
    appendOrder(BRANCH, order("b"));

    expect(removeOrder(BRANCH, "b").map((o) => o.token)).toEqual(["a"]);
    expect(readOrderHistory(BRANCH).map((o) => o.token)).toEqual(["a"]);
  });
});

describe("aislamiento por sucursal", () => {
  it("no mezcla el historial de dos sucursales", () => {
    appendOrder("br-1", order("de-la-1"));
    appendOrder("br-2", order("de-la-2"));

    expect(readOrderHistory("br-1").map((o) => o.token)).toEqual(["de-la-1"]);
    expect(readOrderHistory("br-2").map((o) => o.token)).toEqual(["de-la-2"]);
  });
});
