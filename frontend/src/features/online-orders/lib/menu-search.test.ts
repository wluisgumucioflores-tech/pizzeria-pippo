import { describe, it, expect } from "vitest";
import { filterProductsByQuery, normalizeText } from "./menu-search";
import type { PublicMenuProduct } from "../types/online-orders.types";

const product = (
  over: Partial<PublicMenuProduct> & Pick<PublicMenuProduct, "id" | "name">,
): PublicMenuProduct => ({
  description: null,
  image_url: null,
  category_id: null,
  category_name: null,
  variants: [{ id: `${over.id}-v`, name: "Única", price: 10 }],
  ...over,
});

const MENU: PublicMenuProduct[] = [
  product({ id: "p1", name: "Muzzarella", description: "Salsa y queso", category_name: "Pizzas" }),
  product({ id: "p2", name: "Café con leche", category_name: "Bebidas" }),
  product({
    id: "p3",
    name: "Fugazzeta",
    category_name: "Pizzas",
    variants: [
      { id: "p3-g", name: "Grande", price: 95 },
      { id: "p3-c", name: "Chica", price: 70 },
    ],
  }),
];

describe("normalizeText", () => {
  it("baja a minúsculas y saca acentos", () => {
    expect(normalizeText("Café")).toBe("cafe");
    expect(normalizeText("Jalapeño")).toBe("jalapeno");
  });

  // La ñ se descompone en n + tilde, así que también queda sin tilde. Es lo
  // que conviene: nadie busca "ñoquis" con la ñ en el teclado del celular.
  it("deja la ñ como n para que se pueda buscar sin ella", () => {
    expect(normalizeText("ÑOQUIS")).toBe("noquis");
  });
});

describe("filterProductsByQuery", () => {
  it("devuelve todo con una búsqueda vacía", () => {
    expect(filterProductsByQuery(MENU, "")).toHaveLength(3);
    expect(filterProductsByQuery(MENU, "   ")).toHaveLength(3);
  });

  it("busca por nombre sin importar mayúsculas", () => {
    expect(filterProductsByQuery(MENU, "muzza").map((p) => p.id)).toEqual(["p1"]);
    expect(filterProductsByQuery(MENU, "MUZZA").map((p) => p.id)).toEqual(["p1"]);
  });

  // El teclado del celular no pone acentos y nadie los escribe al buscar.
  it("encuentra una palabra con acento escrita sin acento", () => {
    expect(filterProductsByQuery(MENU, "cafe").map((p) => p.id)).toEqual(["p2"]);
  });

  it("busca por descripción", () => {
    expect(filterProductsByQuery(MENU, "queso").map((p) => p.id)).toEqual(["p1"]);
  });

  it("busca por categoría, así 'pizzas' trae la categoría entera", () => {
    expect(filterProductsByQuery(MENU, "pizzas").map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("busca por nombre de variante", () => {
    expect(filterProductsByQuery(MENU, "grande").map((p) => p.id)).toEqual(["p3"]);
  });

  it("devuelve vacío si no hay coincidencias", () => {
    expect(filterProductsByQuery(MENU, "sushi")).toEqual([]);
  });
});
