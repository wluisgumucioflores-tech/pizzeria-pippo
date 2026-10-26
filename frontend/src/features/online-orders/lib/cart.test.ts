import { describe, it, expect } from "vitest";
import {
  addToCart,
  cartCount,
  cartTotal,
  groupIntoSections,
  isCartFull,
  setQty,
} from "./cart";
import {
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_LINE,
  UNCATEGORIZED_ID,
} from "../constants/online-orders.constants";
import type { CartLine, PublicMenuProduct, PublicMenuVariant } from "../types/online-orders.types";

const variant = (id: string, price = 70): PublicMenuVariant => ({
  id,
  name: "Grande",
  price,
});

const product = (id: string, name = "Napolitana", categoryId: string | null = "cat1"): PublicMenuProduct => ({
  id,
  name,
  description: null,
  image_url: null,
  category_id: categoryId,
  category_name: categoryId ? "Pizzas" : null,
  variants: [variant(`${id}-v1`)],
});

const line = (over: Partial<CartLine> = {}): CartLine => ({
  variant_id: "v1",
  product_name: "Napolitana",
  variant_name: "Grande",
  price: 70,
  qty: 1,
  ...over,
});

describe("cart", () => {
  describe("totales", () => {
    it("multiplica precio por cantidad y suma las líneas", () => {
      expect(cartTotal([line({ qty: 2 }), line({ variant_id: "v2", price: 15 })])).toBe(155);
    });

    it("cuenta unidades, no líneas", () => {
      expect(cartCount([line({ qty: 2 }), line({ variant_id: "v2", qty: 3 })])).toBe(5);
    });

    // El total que ve el cliente tiene que coincidir con el que calcula el
    // servidor, que también redondea a 2 decimales.
    it("redondea a 2 decimales en lugar de arrastrar error de float", () => {
      expect(cartTotal([line({ price: 0.1, qty: 3 })])).toBe(0.3);
    });

    it("carrito vacío da 0, no NaN", () => {
      expect(cartTotal([])).toBe(0);
      expect(cartCount([])).toBe(0);
    });
  });

  describe("addToCart", () => {
    it("agrega una línea nueva con cantidad 1", () => {
      const result = addToCart([], product("p1"), variant("p1-v1"));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ variant_id: "p1-v1", qty: 1, price: 70 });
    });

    it("suma cantidad si la variante ya está en el carrito", () => {
      const result = addToCart([line({ variant_id: "p1-v1", qty: 2 })], product("p1"), variant("p1-v1"));

      expect(result).toHaveLength(1);
      expect(result[0].qty).toBe(3);
    });

    it("no muta el array original", () => {
      const original = [line({ variant_id: "p1-v1" })];
      addToCart(original, product("p1"), variant("p1-v1"));
      expect(original[0].qty).toBe(1);
    });

    it("topea la cantidad por línea en lugar de fallar", () => {
      const result = addToCart(
        [line({ variant_id: "p1-v1", qty: MAX_QTY_PER_LINE })],
        product("p1"),
        variant("p1-v1"),
      );
      expect(result[0].qty).toBe(MAX_QTY_PER_LINE);
    });

    // El DTO del backend rechaza más de MAX_ITEMS_PER_PUBLIC_ORDER líneas: la
    // UI corta antes para que el cliente no se coma un 400.
    it("no agrega líneas nuevas una vez alcanzado el máximo", () => {
      const full = Array.from({ length: MAX_LINES_PER_ORDER }, (_, i) =>
        line({ variant_id: `v${i}` }),
      );

      const result = addToCart(full, product("nuevo"), variant("nuevo-v1"));

      expect(result).toHaveLength(MAX_LINES_PER_ORDER);
      expect(isCartFull(result)).toBe(true);
    });

    it("pero sí deja seguir sumando a una línea existente con el carrito lleno", () => {
      const full = Array.from({ length: MAX_LINES_PER_ORDER }, (_, i) =>
        line({ variant_id: `v${i}` }),
      );

      const result = addToCart(full, product("p0"), variant("v0"));

      expect(result).toHaveLength(MAX_LINES_PER_ORDER);
      expect(result.find((l) => l.variant_id === "v0")?.qty).toBe(2);
    });
  });

  describe("setQty", () => {
    it("cambia la cantidad de una línea", () => {
      const result = setQty([line({ variant_id: "v1" })], "v1", 4);
      expect(result[0].qty).toBe(4);
    });

    it("quita la línea si la cantidad llega a 0", () => {
      expect(setQty([line({ variant_id: "v1" })], "v1", 0)).toEqual([]);
    });

    it("quita la línea con cantidades negativas (botón menos pasado de largo)", () => {
      expect(setQty([line({ variant_id: "v1" })], "v1", -3)).toEqual([]);
    });

    it("topea en el máximo por línea", () => {
      const result = setQty([line({ variant_id: "v1" })], "v1", 999);
      expect(result[0].qty).toBe(MAX_QTY_PER_LINE);
    });

    it("ignora una variante que no está en el carrito", () => {
      const cart = [line({ variant_id: "v1" })];
      expect(setQty(cart, "inexistente", 5)).toEqual(cart);
    });
  });

  describe("groupIntoSections", () => {
    it("agrupa por categoría conservando el orden de aparición", () => {
      const sections = groupIntoSections(
        [
          product("p1", "Napolitana", "cat-pizzas"),
          product("p2", "Coca", "cat-bebidas"),
          product("p3", "Margarita", "cat-pizzas"),
        ],
        "Otros",
      );

      expect(sections.map((s) => s.category_id)).toEqual(["cat-pizzas", "cat-bebidas"]);
      expect(sections[0].products.map((p) => p.name)).toEqual(["Napolitana", "Margarita"]);
    });

    // Un producto sin categoría igual tiene que aparecer en algún lado del
    // menú, no desaparecer.
    it("manda los productos sin categoría a una sección propia", () => {
      const sections = groupIntoSections([product("p1", "Suelto", null)], "Otros");

      expect(sections).toHaveLength(1);
      expect(sections[0].category_id).toBe(UNCATEGORIZED_ID);
      expect(sections[0].category_name).toBe("Otros");
    });

    it("una lista vacía no genera secciones", () => {
      expect(groupIntoSections([], "Otros")).toEqual([]);
    });
  });
});
